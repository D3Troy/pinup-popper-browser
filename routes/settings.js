"use strict";
const express = require("express");
const fs = require("node:fs/promises");
const YAML = require("yaml");
const { resolveConfigPath } = require("../settings");

function formatDateExample(fmt) {
  const now = new Date();
  function pad(n) { return n.toString().padStart(2, "0"); }
  if (fmt && /[dMyHhms]/.test(fmt)) {
    const map = { dd: pad(now.getDate()), MM: pad(now.getMonth() + 1), yyyy: now.getFullYear(), HH: pad(now.getHours()), mm: pad(now.getMinutes()), ss: pad(now.getSeconds()) };
    return fmt.replace(/dd|MM|yyyy|HH|mm|ss/g, k => map[k] || k);
  }
  return now.toLocaleString();
}

const ALL_FIELDS = [
  "year", "type", "manufacturer", "numPlayers", "emulator",
  "category", "theme", "rating", "lastPlayed", "numPlays",
  "timePlayed", "designedBy", "webLinkUrl", "gameVersion",
  "gameDescription", "romName", "tableType",
];

function createRouter(settings) {
  const router = express.Router();

  router.get("/", function (req, res) {
    const games = req.app.locals.games;
    const previewGame = games.length
      ? games[Math.floor(Math.random() * games.length)]
      : null;
    const wheelSrc = previewGame ? req.app.locals.getWheelSrc(previewGame) : null;
    const wheelRotation = settings.media.useThumbs
      ? req.app.locals.globalSettings.thumbRotation : 0;

    const homeSamples = games.slice(0, 18).map(g => req.app.locals.getWheelSrc(g));

    const useThumbs = settings.media.useThumbs;
    const playlistRows = req.app.locals.queryRows(
      "SELECT Logo FROM Playlists WHERE PlayListParent = 0 AND Visible = 1 ORDER BY PlayListID"
    );
    const playlistSamples = playlistRows.slice(0, 18).map(function (row) {
      const logo = row.Logo || "";
      return useThumbs
        ? `/media/playlists/pthumbs/${encodeURIComponent(logo)}_thumb.png`
        : `/media/playlists/${encodeURIComponent(logo)}.png`;
    });

    res.render("settings", {
      cfg: settings,
      allFields: ALL_FIELDS,
      gameFields: req.app.locals.gameFields,
      previewGame,
      wheelSrc,
      wheelRotation,
      homeSamples,
      playlistSamples,
      dateFormatExample: formatDateExample(settings.options.dateFormat),
      isSettingsPage: true,
    });
  });

  router.post("/", async function (req, res) {
    const b = req.body;

    const gameFields = b.gameFields
      ? Array.isArray(b.gameFields) ? b.gameFields : [b.gameFields]
      : [];

    settings.options.defaultView   = b.defaultView || "home";
    settings.options.dateFormat    = b.dateFormat   || settings.options.dateFormat;
    settings.options.filters = {
      category:     b["filters.category"]     === "on",
      theme:        b["filters.theme"]        === "on",
      type:         b["filters.type"]         === "on",
      decade:       b["filters.decade"]       === "on",
      emulator:     b["filters.emulator"]     === "on",
      manufacturer: b["filters.manufacturer"] === "on",
      favorites:    b["filters.favorites"]    === "on",
    };
    settings.options.game = {
      info:      b["game.info"]      === "on",
      help:      b["game.help"]      === "on",
      playfield: b["game.playfield"] === "on",
      highscore: b["game.highscore"] === "on",
      media: {
        topper:    b["game.media.topper"]    === "on",
        backglass: b["game.media.backglass"] === "on",
        fulldmd:   b["game.media.fulldmd"]   === "on",
        dmd:   b["game.media.dmd"]   === "on",
        playfield: b["game.media.playfield"] === "on",
        help:      b["game.media.help"]      === "on",
        info:      b["game.media.info"]      === "on",
      },
    };
    settings.options.gameFields    = gameFields;
    settings.media.useThumbs         = b["media.useThumbs"]          === "on";
    settings.media.playfieldRotation = b["media.playfieldRotation"]  === "on";
    settings.media.cacheInMinutes    = parseInt(b["media.cacheInMinutes"], 10) || settings.media.cacheInMinutes;

    const folderSlots = ["topper", "backglass", "fulldmd", "dmd", "playfield", "help", "info", "highscore"];
    if (!settings.media.folders) settings.media.folders = {};
    folderSlots.forEach(function (slot) {
      const val = (b["media.folders." + slot] || "").trim();
      if (val) settings.media.folders[slot] = val;
    });


    req.app.locals.gameFields = gameFields;
    req.app.locals.dateFormat = settings.options.dateFormat;

    const configPath = await resolveConfigPath();
    await fs.writeFile(configPath, YAML.stringify(settings), "utf8");

    const defaultView = settings.options.defaultView || "home";
    res.redirect(defaultView === "playlists" ? "/playlists" : "/");
  });

  return router;
}

module.exports = createRouter;
