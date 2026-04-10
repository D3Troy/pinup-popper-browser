var express = require("express");
var fs = require("node:fs");
const path = require("path");
var debug = require("debug");

function createRouter(settings) {
  var router = express.Router();

  var getCurItemUrl = settings.pupServer.url + "/function/getcuritem";
  var launchUrl = settings.pupServer.url + "/function/launchgame/";
  var exitUrl = settings.pupServer.url + "/pupkey/15";

  async function fetchStatus(url) {
    const response = await fetch(url);
    return response.status;
  }

  async function fetchJson(url) {
    const response = await fetch(url);
    if (response.status !== 200) {
      throw new Error("Unexpected status: " + response.status);
    }
    return response.json();
  }

  router.get("/:gameId/info", function (req, res) {
    getMediaFilenames(req, res, "GameInfo", ["png", "jpg"]);
  });

  router.post("/:gameId/fav", function (req, res) {
    const gameId = parseInt(req.params["gameId"], 10);
    if (isNaN(gameId)) return res.status(400).json({ error: "Invalid input" });
    const game = getGame(gameId, req);
    if (!game) return res.status(404).json({ error: "Game not found" });

    const newValue = game.favorite ? null : 1;
    req.app.locals.runSql("UPDATE PlayListDetails SET isFav = ? WHERE GameID = ?", [newValue, gameId])
      .then(function () {
        game.favorite = newValue || 0;
        res.json({ favorite: newValue || 0 });
      })
      .catch(function (err) {
        res.status(500).json({ error: err.message });
      });
  });

  router.get("/:gameId/help", function (req, res) {
    getMediaFilenames(req, res, "GameHelp", ["png", "jpg"]);
  });

  router.get("/:gameId/playfield", function (req, res) {
    getMediaFilenames(req, res, "Playfield", ["png", "jpg", "mp4"]);
  });

  router.get("/:gameId/highscore", function (req, res) {
    const folder = (settings.media && settings.media.folders && settings.media.folders.highscore) || "Other4";
    getMediaFilenames(req, res, folder, ["png", "jpg"]);
  });

  router.get("/:gameId/media", function (req, res) {
    const game = getGame(req.params["gameId"], req);
    if (!game) { res.status(404).send({}); return; }
    const slots = settings.options.game.media && typeof settings.options.game.media === "object"
      ? settings.options.game.media
      : { topper: true, backglass: true, dmd: true, playfield: true, help: true, info: true };
    const result = {};
    for (const type of MEDIA_OVERVIEW_TYPES) {
      if (slots[type.key]) {
        result[type.key] = resolveMediaFiles(game, req, type.dir, type.ext);
      }
    }
    res.send(result);
  });

  router.get("/:gameId/launch", async function (req, res) {
    let gameId = req.params["gameId"];
    try {
      const status = await fetchStatus(launchUrl + gameId);
      if (status !== 200) {
        res.status(500);
        res.send("ERROR");
        return;
      }
      res.send("OK");
    } catch (_err) {
      res.status(500);
      res.send("ERROR");
    }
  });

  router.get("/exit", async function (_req, res) {
    try {
      const status = await fetchStatus(exitUrl);
      if (status !== 200) {
        res.status(500);
        res.send("ERROR");
        return;
      }
      res.send("OK");
    } catch (_err) {
      res.status(500);
      res.send("ERROR");
    }
  });

  router.get("/:gameId", function (req, res) {
    let gameId = req.params["gameId"];

    if (gameId == "last") {
      let game = getLastPlayed(req);
      if (game) {
        renderGame(req, res, game.id);
      } else {
        renderGameError(req, res, "Unable to determine last played game");
      }
    } else if (gameId == "current") {
      fetchJson(getCurItemUrl)
        .then((data) => {
          gameId = data.GameID;
          renderGame(req, res, gameId);
        })
        .catch(() => {
          renderGameError(req, res, "Unable to determine current game");
        });
    } else {
      renderGame(req, res, gameId);
    }
  });

  function getLastPlayed(req) {
    let sql =
      "SELECT g.GameID, LastPlayed, NumberPlays, TimePlayedSecs " +
      "FROM Games g JOIN GamesStats s on g.GameID = s.GameID " +
      "ORDER BY LastPlayed DESC LIMIT 1";

    const row = req.app.locals.queryRow(sql);

    if (row) {
      let game = getGame(row.GameID, req);
      if (game) {
        // update with latest stats
        game.lastPlayed = row.LastPlayed;
        game.numPlays = row.NumberPlays;
        game.timePlayed = row.TimePlayedSecs;
      }
      return game;
    }
    return;
  }

  function getGame(gameId, req) {
    let gamePos = req.app.locals.gameIds.get(parseInt(gameId));
    return gamePos === undefined ? gamePos : req.app.locals.games[gamePos];
  }

  function renderGameError(_req, res, msg) {
    res.render("game_error", {
      message: msg,
    });
  }

  function renderGame(req, res, gameId) {
    let game = getGame(gameId, req);
    if (game) {
      const playlistId = req.query.playlist || null;
      const homeUrl = playlistId ? "/playlists" : "/home";

      res.render("game", {
        game: game,
        info: settings.options.game.info,
        help: settings.options.game.help,
        playfield: settings.options.game.playfield,
        media: settings.options.game.media && typeof settings.options.game.media === "object"
          ? settings.options.game.media
          : (settings.options.game.media ? { topper: true, backglass: true, dmd: true, playfield: true, help: true, info: true } : false),
        highscore: settings.options.game.highscore,
        playlistId: playlistId,
        homeUrl: homeUrl,
        wheelRotation: settings.media.useThumbs
          ? req.app.locals.globalSettings.thumbRotation
          : 0,
        playfieldRotation: settings.media.playfieldRotation,
        refreshInterval: req.app.locals.globalSettings.currentGameRefreshTimer,
      });
    } else {
      renderGameError(req, res, "Game not found");
    }
  }

  function escapeGlob(text) {
    return text.replace(/[*?[\]{}()!@+^]/g, (c) => `[${c}]`);
  }

  function resolveMediaFiles(game, req, mediaDir, extensions) {
    const patterns = extensions.map(
      (ext) => escapeGlob(game.name) + "*." + ext
    );
    const dir = game.emulator.dirMedia.replace(/\\/g, "/") + "/" + mediaDir;
    const files = fs.globSync(patterns, { cwd: dir });
    debug("app:media")(
      "Search for '%s' in '%s' found %i files.",
      patterns.toString(),
      dir,
      files.length
    );
    let result = [];
    for (const file of files) {
      result.push(
        [req.app.locals.getMediaPath(game), mediaDir, path.basename(file)].join(
          "/"
        )
      );
    }
    return result;
  }

  function getMediaFilenames(req, res, mediaDir, extensions) {
    const game = getGame(req.params["gameId"], req);
    if (!game) { res.send([]); return; }
    res.send(resolveMediaFiles(game, req, mediaDir, extensions));
  }

  const folderMap = (settings.media && settings.media.folders) || {};
  const MEDIA_OVERVIEW_TYPES = [
    { key: "topper",    dir: folderMap.topper    || "Topper",    ext: ["png", "jpg", "mp4"] },
    { key: "backglass", dir: folderMap.backglass  || "BackGlass", ext: ["png", "jpg", "mp4"] },
    { key: "dmd",       dir: folderMap.dmd        || "Menu",      ext: ["png", "jpg", "mp4"] },
    { key: "playfield", dir: folderMap.playfield  || "Playfield", ext: ["png", "jpg", "mp4"] },
    { key: "help",      dir: folderMap.help       || "GameHelp",  ext: ["png", "jpg"] },
    { key: "info",      dir: folderMap.info       || "GameInfo",  ext: ["png", "jpg"] },
  ];

  return router;
}

module.exports = createRouter;
