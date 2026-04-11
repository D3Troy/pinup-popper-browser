"use strict";

const express = require("express");
const request = require("supertest");

function createGameApp(router, locals) {
    const app = express();
    app.use(express.urlencoded({ extended: false }));

    app.locals.games = locals.games;
    app.locals.gameIds = locals.gameIds;
    app.locals.globalSettings = locals.globalSettings;
    app.locals.queryRow = locals.queryRow;
    app.locals.runSql = locals.runSql;
    app.locals.getMediaPath = locals.getMediaPath;
    app.locals.gameFields = locals.gameFields;
    app.locals.dateFormat = locals.dateFormat;
    app.locals.timeFormat = locals.timeFormat;
    app.locals.locale = locals.locale;

    app.use((req, res, next) => {
        res.render = (view, options) => {
            res.json({ view, options });
        };
        next();
    });

    app.use("/games", router);
    return app;
}

function baseLocals() {
    const game = {
        id: 1,
        name: "Attack From Mars",
        display: "Attack From Mars",
        emulator: {
            id: 7,
            name: "Visual Pinball",
            dirMedia: "C:\\Media",
        },
        lastPlayed: null,
        numPlays: 0,
        timePlayed: 0,
    };

    return {
        games: [game],
        gameIds: new Map([[1, 0]]),
        globalSettings: {
            thumbRotation: 180,
            currentGameRefreshTimer: 45000,
        },
        queryRow: jest.fn(),
        runSql: jest.fn().mockResolvedValue(),
        getMediaPath: (inputGame) => `/media/${inputGame.emulator.id}`,
    };
}

describe("routes/game", () => {
    let globSync;
    let settings;

    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();

        globSync = jest.fn();
        jest.doMock("node:fs", () => ({
            globSync,
        }));

        settings = {
            pupServer: { url: "http://localhost" },
            options: { game: { info: true, help: true, playfield: true } },
            media: { useThumbs: true, playfieldRotation: true },
        };
    });

    afterEach(() => {
        delete global.fetch;
    });

    test("GET /games/:id renders game details", async () => {
        const createRouter = require("../routes/game");
        const router = createRouter(settings);
        const app = createGameApp(router, baseLocals());

        const response = await request(app).get("/games/1");

        expect(response.status).toBe(200);
        expect(response.body.view).toBe("game");
        expect(response.body.options.game.id).toBe(1);
        expect(response.body.options.wheelRotation).toBe(180);
        expect(response.body.options.playfieldRotation).toBe(true);
        expect(response.body.options.refreshInterval).toBe(45000);
    });

    test("GET /games/:id renders game error for unknown id", async () => {
        const createRouter = require("../routes/game");
        const router = createRouter(settings);
        const app = createGameApp(router, baseLocals());

        const response = await request(app).get("/games/999");

        expect(response.status).toBe(200);
        expect(response.body.view).toBe("game_error");
        expect(response.body.options.message).toBe("Game not found");
    });

    test("GET /games/last renders last played game and updates stats", async () => {
        settings.media.useThumbs = false;
        settings.media.playfieldRotation = false;

        const locals = baseLocals();
        locals.queryRow.mockReturnValue({
            GameID: 1,
            LastPlayed: "2026-03-01",
            NumberPlays: 22,
            TimePlayedSecs: 999,
        });

        const createRouter = require("../routes/game");
        const router = createRouter(settings);
        const app = createGameApp(router, locals);

        const response = await request(app).get("/games/last");

        expect(response.status).toBe(200);
        expect(response.body.view).toBe("game");
        expect(response.body.options.game.lastPlayed).toBe("2026-03-01");
        expect(response.body.options.game.numPlays).toBe(22);
        expect(response.body.options.game.timePlayed).toBe(999);
        expect(response.body.options.wheelRotation).toBe(0);
    });

    test("GET /games/last renders error when no stats row is found", async () => {
        const locals = baseLocals();
        locals.queryRow.mockReturnValue(undefined);

        const createRouter = require("../routes/game");
        const router = createRouter(settings);
        const app = createGameApp(router, locals);

        const response = await request(app).get("/games/last");

        expect(response.status).toBe(200);
        expect(response.body.view).toBe("game_error");
        expect(response.body.options.message).toBe(
            "Unable to determine last played game"
        );
    });

    test("GET /games/current resolves current game from remote endpoint", async () => {
        global.fetch = jest.fn().mockResolvedValue({
            status: 200,
            json: async () => ({ GameID: 1 }),
        });

        const createRouter = require("../routes/game");
        const router = createRouter(settings);
        const app = createGameApp(router, baseLocals());

        const response = await request(app).get("/games/current");

        expect(response.status).toBe(200);
        expect(response.body.view).toBe("game");
        expect(global.fetch).toHaveBeenCalledWith(
            "http://localhost/function/getcuritem"
        );
    });

    test("GET /games/current renders error when remote lookup fails", async () => {
        global.fetch = jest.fn().mockResolvedValue({
            status: 503,
            json: async () => ({ GameID: 1 }),
        });

        const createRouter = require("../routes/game");
        const router = createRouter(settings);
        const app = createGameApp(router, baseLocals());

        const response = await request(app).get("/games/current");

        expect(response.status).toBe(200);
        expect(response.body.view).toBe("game_error");
        expect(response.body.options.message).toBe("Unable to determine current game");
    });

    test("GET /games/:id/launch returns OK when remote launch succeeds", async () => {
        global.fetch = jest.fn().mockResolvedValue({ status: 200 });

        const createRouter = require("../routes/game");
        const router = createRouter(settings);
        const app = createGameApp(router, baseLocals());

        const response = await request(app).get("/games/1/launch");

        expect(response.status).toBe(200);
        expect(response.text).toBe("OK");
        expect(global.fetch).toHaveBeenCalledWith(
            "http://localhost/function/launchgame/1"
        );
    });

    test("GET /games/:id/launch returns ERROR when remote launch fails", async () => {
        global.fetch = jest.fn().mockRejectedValue(new Error("network"));

        const createRouter = require("../routes/game");
        const router = createRouter(settings);
        const app = createGameApp(router, baseLocals());

        const response = await request(app).get("/games/1/launch");

        expect(response.status).toBe(500);
        expect(response.text).toBe("ERROR");
    });

    test("GET /games/exit returns OK and ERROR for success/failure", async () => {
        global.fetch = jest
            .fn()
            .mockResolvedValueOnce({ status: 200 })
            .mockResolvedValueOnce({ status: 500 });

        const createRouter = require("../routes/game");
        const router = createRouter(settings);
        const app = createGameApp(router, baseLocals());

        const okResponse = await request(app).get("/games/exit");
        const errorResponse = await request(app).get("/games/exit");

        expect(okResponse.status).toBe(200);
        expect(okResponse.text).toBe("OK");
        expect(errorResponse.status).toBe(500);
        expect(errorResponse.text).toBe("ERROR");
        expect(global.fetch).toHaveBeenNthCalledWith(
            1,
            "http://localhost/pupkey/15"
        );
    });

    test("GET /games/:id/info and playfield return matching media URLs", async () => {
        globSync
            .mockReturnValueOnce(["Attack From Mars one.png", "Attack From Mars 2.jpg"])
            .mockReturnValueOnce(["Attack From Mars trailer.mp4"]);

        const createRouter = require("../routes/game");
        const router = createRouter(settings);
        const app = createGameApp(router, baseLocals());

        const infoResponse = await request(app).get("/games/1/info");
        const playfieldResponse = await request(app).get("/games/1/playfield");

        expect(infoResponse.status).toBe(200);
        expect(infoResponse.body).toEqual([
            "/media/7/GameInfo/Attack From Mars one.png",
            "/media/7/GameInfo/Attack From Mars 2.jpg",
        ]);

        expect(playfieldResponse.status).toBe(200);
        expect(playfieldResponse.body).toEqual([
            "/media/7/PlayField/Attack From Mars trailer.mp4",
        ]);

        expect(globSync).toHaveBeenCalledTimes(2);
    });

    test("POST /games/:id/rating sets rating and returns new value", async () => {
        const locals = baseLocals();
        locals.games[0].rating = 0;

        const createRouter = require("../routes/game");
        const router = createRouter(settings);
        const app = createGameApp(router, locals);

        const response = await request(app)
            .post("/games/1/rating")
            .type("form")
            .send({ rating: "4" });

        expect(response.status).toBe(200);
        expect(response.body.rating).toBe(4);
        expect(locals.games[0].rating).toBe(4);
        expect(locals.runSql).toHaveBeenCalledWith(
            "UPDATE Games SET GameRating = ? WHERE GameID = ?",
            [4, 1]
        );
    });

    test("POST /games/:id/rating returns 400 for invalid rating", async () => {
        const createRouter = require("../routes/game");
        const router = createRouter(settings);
        const app = createGameApp(router, baseLocals());

        const tooHigh = await request(app).post("/games/1/rating").type("form").send({ rating: "6" });
        const negative = await request(app).post("/games/1/rating").type("form").send({ rating: "-1" });
        const notNum = await request(app).post("/games/1/rating").type("form").send({ rating: "abc" });

        expect(tooHigh.status).toBe(400);
        expect(negative.status).toBe(400);
        expect(notNum.status).toBe(400);
    });

    test("POST /games/:id/rating returns 404 for unknown game", async () => {
        const createRouter = require("../routes/game");
        const router = createRouter(settings);
        const app = createGameApp(router, baseLocals());

        const response = await request(app).post("/games/999/rating").type("form").send({ rating: "3" });

        expect(response.status).toBe(404);
    });

    test("POST /games/:id/rating allows clearing rating with 0", async () => {
        const locals = baseLocals();
        locals.games[0].rating = 3;

        const createRouter = require("../routes/game");
        const router = createRouter(settings);
        const app = createGameApp(router, locals);

        const response = await request(app)
            .post("/games/1/rating")
            .type("form")
            .send({ rating: "0" });

        expect(response.status).toBe(200);
        expect(response.body.rating).toBe(0);
        expect(locals.games[0].rating).toBe(0);
    });

    test("POST /games/:id/rating returns 500 when SQL fails", async () => {
        const locals = baseLocals();
        locals.runSql = jest.fn().mockRejectedValue(new Error("db error"));

        const createRouter = require("../routes/game");
        const router = createRouter(settings);
        const app = createGameApp(router, locals);

        const response = await request(app)
            .post("/games/1/rating")
            .type("form")
            .send({ rating: "3" });

        expect(response.status).toBe(500);
        expect(response.body.error).toBe("db error");
    });

    test("POST /games/:id/rating returns 400 for non-numeric gameId", async () => {
        const createRouter = require("../routes/game");
        const router = createRouter(settings);
        const app = createGameApp(router, baseLocals());

        const response = await request(app)
            .post("/games/abc/rating")
            .type("form")
            .send({ rating: "3" });

        expect(response.status).toBe(400);
    });

    test("POST /games/:id/fav toggles favorite on (null → 1)", async () => {
        const locals = baseLocals();
        locals.games[0].favorite = null;

        const createRouter = require("../routes/game");
        const router = createRouter(settings);
        const app = createGameApp(router, locals);

        const response = await request(app).post("/games/1/fav");

        expect(response.status).toBe(200);
        expect(response.body.favorite).toBe(1);
        expect(locals.games[0].favorite).toBe(1);
        expect(locals.runSql).toHaveBeenCalledWith(
            "UPDATE PlayListDetails SET isFav = ? WHERE GameID = ?",
            [1, 1]
        );
    });

    test("POST /games/:id/fav toggles favorite off (1 → null)", async () => {
        const locals = baseLocals();
        locals.games[0].favorite = 1;

        const createRouter = require("../routes/game");
        const router = createRouter(settings);
        const app = createGameApp(router, locals);

        const response = await request(app).post("/games/1/fav");

        expect(response.status).toBe(200);
        expect(response.body.favorite).toBe(0);
        expect(locals.games[0].favorite).toBe(0);
        expect(locals.runSql).toHaveBeenCalledWith(
            "UPDATE PlayListDetails SET isFav = ? WHERE GameID = ?",
            [null, 1]
        );
    });

    test("POST /games/:id/fav returns 400 for non-numeric gameId", async () => {
        const createRouter = require("../routes/game");
        const router = createRouter(settings);
        const app = createGameApp(router, baseLocals());

        const response = await request(app).post("/games/abc/fav");

        expect(response.status).toBe(400);
    });

    test("POST /games/:id/fav returns 404 for unknown game", async () => {
        const createRouter = require("../routes/game");
        const router = createRouter(settings);
        const app = createGameApp(router, baseLocals());

        const response = await request(app).post("/games/999/fav");

        expect(response.status).toBe(404);
    });

    test("POST /games/:id/fav returns 500 when SQL fails", async () => {
        const locals = baseLocals();
        locals.runSql = jest.fn().mockRejectedValue(new Error("db error"));

        const createRouter = require("../routes/game");
        const router = createRouter(settings);
        const app = createGameApp(router, locals);

        const response = await request(app).post("/games/1/fav");

        expect(response.status).toBe(500);
        expect(response.body.error).toBe("db error");
    });

    test("GET /games/:id/launch returns ERROR when remote returns non-200", async () => {
        global.fetch = jest.fn().mockResolvedValue({ status: 503 });

        const createRouter = require("../routes/game");
        const router = createRouter(settings);
        const app = createGameApp(router, baseLocals());

        const response = await request(app).get("/games/1/launch");

        expect(response.status).toBe(500);
        expect(response.text).toBe("ERROR");
    });

    test("GET /games/current renders error when fetch throws", async () => {
        global.fetch = jest.fn().mockRejectedValue(new Error("network"));

        const createRouter = require("../routes/game");
        const router = createRouter(settings);
        const app = createGameApp(router, baseLocals());

        const response = await request(app).get("/games/current");

        expect(response.status).toBe(200);
        expect(response.body.view).toBe("game_error");
        expect(response.body.options.message).toBe("Unable to determine current game");
    });

    test("GET /games/:id/help and /highscore return matching media URLs", async () => {
        globSync
            .mockReturnValueOnce(["Attack From Mars rules.png"])
            .mockReturnValueOnce(["Attack From Mars hs.jpg"]);

        const createRouter = require("../routes/game");
        const router = createRouter(settings);
        const app = createGameApp(router, baseLocals());

        const helpResponse = await request(app).get("/games/1/help");
        const hsResponse = await request(app).get("/games/1/highscore");

        expect(helpResponse.status).toBe(200);
        expect(helpResponse.body).toEqual(["/media/7/GameHelp/Attack From Mars rules.png"]);

        expect(hsResponse.status).toBe(200);
        expect(hsResponse.body).toEqual(["/media/7/Other2/Attack From Mars hs.jpg"]);
    });

    test("GET /games/:id/info returns empty array for unknown game", async () => {
        const createRouter = require("../routes/game");
        const router = createRouter(settings);
        const app = createGameApp(router, baseLocals());

        const response = await request(app).get("/games/999/info");

        expect(response.status).toBe(200);
        expect(response.body).toEqual([]);
    });

    test("GET /games/:id/media returns overview with default slots", async () => {
        globSync.mockReturnValue([]);

        const createRouter = require("../routes/game");
        const router = createRouter(settings);
        const app = createGameApp(router, baseLocals());

        const response = await request(app).get("/games/1/media");

        expect(response.status).toBe(200);
        // media option is not an object in default settings, so defaults apply
        // default slots: topper, backglass, fulldmd, playfield, help, info are true; dmd is false
        expect(response.body).toHaveProperty("topper");
        expect(response.body).toHaveProperty("backglass");
        expect(response.body).toHaveProperty("playfield");
        expect(response.body).toHaveProperty("help");
        expect(response.body).toHaveProperty("info");
        expect(response.body).not.toHaveProperty("dmd");
    });

    test("GET /games/:id/media returns only enabled slots when media is an object", async () => {
        globSync.mockReturnValue([]);
        settings.options.game.media = { backglass: true, playfield: true };

        const createRouter = require("../routes/game");
        const router = createRouter(settings);
        const app = createGameApp(router, baseLocals());

        const response = await request(app).get("/games/1/media");

        expect(response.status).toBe(200);
        expect(Object.keys(response.body)).toEqual(["backglass", "playfield"]);
    });

    test("GET /games/:id/media returns 404 for unknown game", async () => {
        const createRouter = require("../routes/game");
        const router = createRouter(settings);
        const app = createGameApp(router, baseLocals());

        const response = await request(app).get("/games/999/media");

        expect(response.status).toBe(404);
    });

    test("GET /games/:id uses custom folderMap from settings.media.folders", async () => {
        globSync.mockReturnValue(["Attack From Mars one.png"]);
        settings.media.folders = { info: "CustomInfo" };

        const createRouter = require("../routes/game");
        const router = createRouter(settings);
        const app = createGameApp(router, baseLocals());

        const response = await request(app).get("/games/1/info");

        expect(response.status).toBe(200);
        expect(response.body[0]).toContain("CustomInfo");
    });

    test("GET /games/:id passes playlistId and uses /playlists homeUrl", async () => {
        const createRouter = require("../routes/game");
        const router = createRouter(settings);
        const app = createGameApp(router, baseLocals());

        const response = await request(app).get("/games/1?playlist=3");

        expect(response.status).toBe(200);
        expect(response.body.view).toBe("game");
        expect(response.body.options.playlistId).toBe("3");
        expect(response.body.options.homeUrl).toBe("/playlists");
    });

    test("GET /games/:id uses gameFields from app.locals", async () => {
        const locals = baseLocals();
        locals.gameFields = ["year", "manufacturer"];

        const createRouter = require("../routes/game");
        const router = createRouter(settings);
        const app = createGameApp(router, locals);

        const response = await request(app).get("/games/1");

        expect(response.status).toBe(200);
        expect(response.body.options.gameFields).toEqual(["year", "manufacturer"]);
        expect(response.body.options.gameFieldRows).toHaveLength(2);
    });

    test("GET /games/:id formats timePlayed into h/m/s string", async () => {
        const locals = baseLocals();
        locals.gameFields = ["timePlayed"];
        locals.games[0].timePlayed = 3725; // 1h 2m 5s

        const createRouter = require("../routes/game");
        const router = createRouter(settings);
        const app = createGameApp(router, locals);

        const response = await request(app).get("/games/1");

        expect(response.status).toBe(200);
        const row = response.body.options.gameFieldRows[0];
        expect(row.value).toBe("1h 2m 5s");
        expect(row.html).toBe(false);
    });

    test("GET /games/:id formats timePlayed as dash when zero", async () => {
        const locals = baseLocals();
        locals.gameFields = ["timePlayed"];
        locals.games[0].timePlayed = 0;

        const createRouter = require("../routes/game");
        const router = createRouter(settings);
        const app = createGameApp(router, locals);

        const response = await request(app).get("/games/1");

        const row = response.body.options.gameFieldRows[0];
        expect(row.value).toBe("—");
    });

    test("GET /games/:id formats lastPlayed with HTML span when set", async () => {
        const locals = baseLocals();
        locals.gameFields = ["lastPlayed"];
        locals.games[0].lastPlayed = "2026-01-15";

        const createRouter = require("../routes/game");
        const router = createRouter(settings);
        const app = createGameApp(router, locals);

        const response = await request(app).get("/games/1");

        const row = response.body.options.gameFieldRows[0];
        expect(row.html).toBe(true);
        expect(row.value).toContain("data-lastplayed=\"2026-01-15\"");
    });

    test("GET /games/:id formats lastPlayed as Never when null", async () => {
        const locals = baseLocals();
        locals.gameFields = ["lastPlayed"];
        locals.games[0].lastPlayed = null;

        const createRouter = require("../routes/game");
        const router = createRouter(settings);
        const app = createGameApp(router, locals);

        const response = await request(app).get("/games/1");

        const row = response.body.options.gameFieldRows[0];
        expect(row.html).toBe(false);
        expect(row.value).toBe("Never");
    });

    test("GET /games/:id formats webLinkUrl as anchor when set", async () => {
        const locals = baseLocals();
        locals.gameFields = ["webLinkUrl"];
        locals.games[0].webLinkUrl = "https://example.com";

        const createRouter = require("../routes/game");
        const router = createRouter(settings);
        const app = createGameApp(router, locals);

        const response = await request(app).get("/games/1");

        const row = response.body.options.gameFieldRows[0];
        expect(row.html).toBe(true);
        expect(row.value).toContain('href="https://example.com"');
    });

    test("GET /games/:id formats webLinkUrl as dash when empty", async () => {
        const locals = baseLocals();
        locals.gameFields = ["webLinkUrl"];
        locals.games[0].webLinkUrl = null;

        const createRouter = require("../routes/game");
        const router = createRouter(settings);
        const app = createGameApp(router, locals);

        const response = await request(app).get("/games/1");

        const row = response.body.options.gameFieldRows[0];
        expect(row.html).toBe(false);
        expect(row.value).toBe("—");
    });

    test("GET /games/:id formats unknown field value as dash when empty", async () => {
        const locals = baseLocals();
        locals.gameFields = ["year"];
        locals.games[0].year = null;

        const createRouter = require("../routes/game");
        const router = createRouter(settings);
        const app = createGameApp(router, locals);

        const response = await request(app).get("/games/1");

        const row = response.body.options.gameFieldRows[0];
        expect(row.html).toBe(false);
        expect(row.value).toBe("—");
    });
});
