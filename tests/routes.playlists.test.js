"use strict";

const express = require("express");
const request = require("supertest");
const crypto = require("crypto");

function computeToken(id, passCode, slot) {
    return crypto.createHash("sha256").update(id + ":" + passCode + ":" + slot).digest("hex");
}

function timeSlot(cacheMinutes) {
    return Math.floor(Date.now() / (cacheMinutes * 60 * 1000));
}

function createPlaylistApp(router, locals) {
    const app = express();
    app.use(express.urlencoded({ extended: false }));

    app.locals.queryRows = locals.queryRows || jest.fn().mockReturnValue([]);
    app.locals.gameIds = locals.gameIds || new Map();
    app.locals.games = locals.games || [];
    app.locals.getWheelSrc = locals.getWheelSrc || (() => "/images/wheel.png");
    app.locals.globalSettings = locals.globalSettings || { thumbRotation: 0 };

    app.use((req, res, next) => {
        res.render = (view, options) => {
            res.json({ view, options });
        };
        next();
    });

    app.use("/playlists", router);
    return app;
}

function baseLocals() {
    return {
        queryRows: jest.fn().mockReturnValue([]),
        gameIds: new Map([[1, 0]]),
        games: [{ id: 1, display: "Attack from Mars", favorite: false }],
        getWheelSrc: () => "/images/wheel.png",
        globalSettings: { thumbRotation: 0 },
    };
}

describe("routes/playlists", () => {
    let settings;

    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();

        settings = {
            options: { defaultView: "home" },
            media: { useThumbs: false, cacheInMinutes: 20 },
        };
    });

    test("GET / renders top-level playlists with homeUrl /home", async () => {
        const locals = baseLocals();
        locals.queryRows.mockReturnValue([{
            PlayListID: 1, Logo: "logo", PlayDisplay: "My Playlist", PlayName: "MyPlaylist",
            PlayListParent: 0, PlayListSQL: "", passcode: "", Visible: 1,
        }]);

        const createRouter = require("../routes/playlists");
        const router = createRouter(settings);
        const app = createPlaylistApp(router, locals);

        const response = await request(app).get("/playlists/");

        expect(response.status).toBe(200);
        expect(response.body.view).toBe("playlists");
        expect(response.body.options.items).toHaveLength(1);
        expect(response.body.options.items[0].display).toBe("My Playlist");
        expect(response.body.options.homeUrl).toBe("/home");
    });

    test("GET / sets homeUrl to /playlists when defaultView is playlists", async () => {
        settings.options.defaultView = "playlists";
        const locals = baseLocals();

        const createRouter = require("../routes/playlists");
        const router = createRouter(settings);
        const app = createPlaylistApp(router, locals);

        const response = await request(app).get("/playlists/");

        expect(response.status).toBe(200);
        expect(response.body.options.homeUrl).toBe("/playlists");
    });

    test("GET / uses thumbnail src when useThumbs is true", async () => {
        settings.media.useThumbs = true;
        const locals = baseLocals();
        locals.globalSettings = { thumbRotation: 90 };
        locals.queryRows.mockReturnValue([{
            PlayListID: 1, Logo: "logo", PlayDisplay: "My Playlist", PlayName: "MyPlaylist",
            PlayListParent: 0, PlayListSQL: "", passcode: "", Visible: 1,
        }]);

        const createRouter = require("../routes/playlists");
        const router = createRouter(settings);
        const app = createPlaylistApp(router, locals);

        const response = await request(app).get("/playlists/");

        expect(response.status).toBe(200);
        expect(response.body.options.items[0].src).toMatch(/_thumb\.png$/);
    });

    test("GET / uses PlayName as display when PlayDisplay is absent", async () => {
        const locals = baseLocals();
        locals.queryRows.mockReturnValue([{
            PlayListID: 1, Logo: "logo", PlayDisplay: null, PlayName: "Fallback Name",
            PlayListParent: 0, PlayListSQL: "", passcode: "", Visible: 1,
        }]);

        const createRouter = require("../routes/playlists");
        const router = createRouter(settings);
        const app = createPlaylistApp(router, locals);

        const response = await request(app).get("/playlists/");

        expect(response.status).toBe(200);
        expect(response.body.options.items[0].display).toBe("Fallback Name");
    });

    test("POST /:id/unlock redirects to /playlists when id is not a number", async () => {
        const locals = baseLocals();

        const createRouter = require("../routes/playlists");
        const router = createRouter(settings);
        const app = createPlaylistApp(router, locals);

        const response = await request(app)
            .post("/playlists/abc/unlock")
            .type("form")
            .send({ pin: "1234" });

        expect(response.status).toBe(302);
        expect(response.headers.location).toBe("/playlists");
        expect(locals.queryRows).not.toHaveBeenCalled();
    });

    test("POST /:id/unlock redirects to /playlists when playlist is not found", async () => {
        const locals = baseLocals();

        const createRouter = require("../routes/playlists");
        const router = createRouter(settings);
        const app = createPlaylistApp(router, locals);

        const response = await request(app)
            .post("/playlists/99/unlock")
            .type("form")
            .send({ pin: "1234" });

        expect(response.status).toBe(302);
        expect(response.headers.location).toBe("/playlists");
    });

    test("POST /:id/unlock sets cookie and redirects when PIN is correct", async () => {
        const locals = baseLocals();
        locals.queryRows.mockReturnValue([{
            PlayListID: 1, Logo: "logo", PlayDisplay: "My Playlist", PlayName: "MyPlaylist",
            PlayListParent: 0, PlayListSQL: "", passcode: "4321", Visible: 1,
        }]);

        const createRouter = require("../routes/playlists");
        const router = createRouter(settings);
        const app = createPlaylistApp(router, locals);

        const response = await request(app)
            .post("/playlists/1/unlock")
            .type("form")
            .send({ pin: "4321" });

        expect(response.status).toBe(302);
        expect(response.headers.location).toBe("/playlists/1");
        expect(response.headers["set-cookie"]).toBeDefined();
        expect(response.headers["set-cookie"][0]).toMatch(/^pl_1=/);
    });

    test("POST /:id/unlock renders playlist_lock with error when PIN is wrong", async () => {
        const locals = baseLocals();
        locals.queryRows.mockReturnValue([{
            PlayListID: 1, Logo: "logo", PlayDisplay: "My Playlist", PlayName: "MyPlaylist",
            PlayListParent: 0, PlayListSQL: "", passcode: "4321", Visible: 1,
        }]);

        const createRouter = require("../routes/playlists");
        const router = createRouter(settings);
        const app = createPlaylistApp(router, locals);

        const response = await request(app)
            .post("/playlists/1/unlock")
            .type("form")
            .send({ pin: "wrong" });

        expect(response.status).toBe(200);
        expect(response.body.view).toBe("playlist_lock");
        expect(response.body.options.error).toMatch(/Incorrect/);
        expect(response.body.options.playlistId).toBe(1);
    });

    test("GET /:id redirects to /playlists when id is not a number", async () => {
        const locals = baseLocals();

        const createRouter = require("../routes/playlists");
        const router = createRouter(settings);
        const app = createPlaylistApp(router, locals);

        const response = await request(app).get("/playlists/notanumber");

        expect(response.status).toBe(302);
        expect(response.headers.location).toBe("/playlists");
        expect(locals.queryRows).not.toHaveBeenCalled();
    });

    test("GET /:id redirects to /playlists when playlist is not found", async () => {
        const locals = baseLocals();

        const createRouter = require("../routes/playlists");
        const router = createRouter(settings);
        const app = createPlaylistApp(router, locals);

        const response = await request(app).get("/playlists/1");

        expect(response.status).toBe(302);
        expect(response.headers.location).toBe("/playlists");
    });

    test("GET /:id renders playlist_lock when passCode is set and no cookie provided", async () => {
        const locals = baseLocals();
        locals.queryRows.mockReturnValue([{
            PlayListID: 1, Logo: "logo", PlayDisplay: "My Playlist", PlayName: "MyPlaylist",
            PlayListParent: 0, PlayListSQL: "", passcode: "9999", Visible: 1,
        }]);

        const createRouter = require("../routes/playlists");
        const router = createRouter(settings);
        const app = createPlaylistApp(router, locals);

        const response = await request(app).get("/playlists/1");

        expect(response.status).toBe(200);
        expect(response.body.view).toBe("playlist_lock");
        expect(response.body.options.error).toBeNull();
        expect(response.body.options.playlistId).toBe(1);
        expect(response.body.options.display).toBe("My Playlist");
    });

    test("GET /:id renders playlist_lock when cookie token is invalid", async () => {
        const locals = baseLocals();
        locals.queryRows.mockReturnValue([{
            PlayListID: 1, Logo: "logo", PlayDisplay: "My Playlist", PlayName: "MyPlaylist",
            PlayListParent: 0, PlayListSQL: "", passcode: "9999", Visible: 1,
        }]);

        const createRouter = require("../routes/playlists");
        const router = createRouter(settings);
        const app = createPlaylistApp(router, locals);

        const response = await request(app)
            .get("/playlists/1")
            .set("Cookie", "pl_1=invalidtoken");

        expect(response.status).toBe(200);
        expect(response.body.view).toBe("playlist_lock");
    });

    test("GET /:id proceeds past passcode check with valid current-slot token", async () => {
        const token = computeToken(1, "9999", timeSlot(20));
        const locals = baseLocals();
        locals.queryRows
            .mockReturnValueOnce([{
                PlayListID: 1, Logo: "logo", PlayDisplay: "My Playlist", PlayName: "MyPlaylist",
                PlayListParent: 0, PlayListSQL: "", passcode: "9999", Visible: 1,
            }])
            .mockReturnValueOnce([]);

        const createRouter = require("../routes/playlists");
        const router = createRouter(settings);
        const app = createPlaylistApp(router, locals);

        const response = await request(app)
            .get("/playlists/1")
            .set("Cookie", `pl_1=${token}`);

        expect(response.status).toBe(200);
        expect(response.body.view).not.toBe("playlist_lock");
    });

    test("GET /:id accepts previous-slot token to handle boundary edge cases", async () => {
        const prevSlotToken = computeToken(1, "9999", timeSlot(20) - 1);
        const locals = baseLocals();
        locals.queryRows
            .mockReturnValueOnce([{
                PlayListID: 1, Logo: "logo", PlayDisplay: "My Playlist", PlayName: "MyPlaylist",
                PlayListParent: 0, PlayListSQL: "", passcode: "9999", Visible: 1,
            }])
            .mockReturnValueOnce([]);

        const createRouter = require("../routes/playlists");
        const router = createRouter(settings);
        const app = createPlaylistApp(router, locals);

        const response = await request(app)
            .get("/playlists/1")
            .set("Cookie", `pl_1=${prevSlotToken}`);

        expect(response.status).toBe(200);
        expect(response.body.view).not.toBe("playlist_lock");
    });

    test("GET /:id renders child playlists when children exist", async () => {
        const locals = baseLocals();
        locals.queryRows
            .mockReturnValueOnce([{
                PlayListID: 1, Logo: "logo", PlayDisplay: "My Playlist", PlayName: "MyPlaylist",
                PlayListParent: 0, PlayListSQL: "", passcode: "", Visible: 1,
            }])
            .mockReturnValueOnce([{
                PlayListID: 2, Logo: "child_logo", PlayDisplay: "Child Playlist", PlayName: "Child",
                PlayListParent: 1, PlayListSQL: "", passcode: "", Visible: 1,
            }]);

        const createRouter = require("../routes/playlists");
        const router = createRouter(settings);
        const app = createPlaylistApp(router, locals);

        const response = await request(app).get("/playlists/1");

        expect(response.status).toBe(200);
        expect(response.body.view).toBe("playlists");
        expect(response.body.options.items).toHaveLength(2);
        expect(response.body.options.items[0].goBack).toBe(true);
        expect(response.body.options.items[0].link).toBe("/playlists");
        expect(response.body.options.items[1].display).toBe("Child Playlist");
    });

    test("GET /:id uses parent-based back URL when playlist has a parent", async () => {
        const locals = baseLocals();
        locals.queryRows
            .mockReturnValueOnce([{
                PlayListID: 1, Logo: "logo", PlayDisplay: "My Playlist", PlayName: "MyPlaylist",
                PlayListParent: 5, PlayListSQL: "", passcode: "", Visible: 1,
            }])
            .mockReturnValueOnce([{
                PlayListID: 2, Logo: "child_logo", PlayDisplay: "Child", PlayName: "Child",
                PlayListParent: 1, PlayListSQL: "", passcode: "", Visible: 1,
            }]);

        const createRouter = require("../routes/playlists");
        const router = createRouter(settings);
        const app = createPlaylistApp(router, locals);

        const response = await request(app).get("/playlists/1");

        expect(response.status).toBe(200);
        expect(response.body.options.items[0].link).toBe("/playlists/5");
    });

    test("GET /:id renders games from gameSQL on leaf playlist", async () => {
        const locals = baseLocals();
        locals.queryRows
            .mockReturnValueOnce([{
                PlayListID: 1, Logo: "logo", PlayDisplay: "My Playlist", PlayName: "MyPlaylist",
                PlayListParent: 0, PlayListSQL: "SELECT * FROM Games", passcode: "", Visible: 1,
            }])
            .mockReturnValueOnce([])
            .mockReturnValueOnce([{ GameID: 1 }]);

        const createRouter = require("../routes/playlists");
        const router = createRouter(settings);
        const app = createPlaylistApp(router, locals);

        const response = await request(app).get("/playlists/1");

        expect(response.status).toBe(200);
        expect(response.body.view).toBe("playlists");
        expect(response.body.options.items).toHaveLength(2);
        expect(response.body.options.items[1].display).toBe("Attack from Mars");
        expect(response.body.options.items[1].link).toMatch(/\/games\/1/);
        expect(response.body.options.items[1].link).toContain("playlist=1");
    });

    test("GET /:id renders error message when gameSQL throws", async () => {
        const locals = baseLocals();
        locals.queryRows
            .mockReturnValueOnce([{
                PlayListID: 1, Logo: "logo", PlayDisplay: "My Playlist", PlayName: "MyPlaylist",
                PlayListParent: 0, PlayListSQL: "BAD SQL", passcode: "", Visible: 1,
            }])
            .mockReturnValueOnce([])
            .mockImplementationOnce(() => { throw new Error("SQL error"); });

        const createRouter = require("../routes/playlists");
        const router = createRouter(settings);
        const app = createPlaylistApp(router, locals);

        const response = await request(app).get("/playlists/1");

        expect(response.status).toBe(200);
        expect(response.body.view).toBe("playlists");
        expect(response.body.options.error).toMatch(/SQL error/);
    });

    test("GET /:id renders games from PlayListDetails when no gameSQL", async () => {
        const locals = baseLocals();
        locals.games = [{ id: 1, display: "Medieval Madness", favorite: true }];
        locals.queryRows
            .mockReturnValueOnce([{
                PlayListID: 1, Logo: "logo", PlayDisplay: "My Playlist", PlayName: "MyPlaylist",
                PlayListParent: 0, PlayListSQL: "", passcode: "", Visible: 1,
            }])
            .mockReturnValueOnce([])
            .mockReturnValueOnce([{ GameID: 1 }]);

        const createRouter = require("../routes/playlists");
        const router = createRouter(settings);
        const app = createPlaylistApp(router, locals);

        const response = await request(app).get("/playlists/1");

        expect(response.status).toBe(200);
        expect(response.body.view).toBe("playlists");
        expect(response.body.options.items[1].display).toBe("Medieval Madness");
        expect(response.body.options.items[1].favorite).toBe(true);
    });

    test("GET /:id renders error message when PlayListDetails query throws", async () => {
        const locals = baseLocals();
        locals.queryRows
            .mockReturnValueOnce([{
                PlayListID: 1, Logo: "logo", PlayDisplay: "My Playlist", PlayName: "MyPlaylist",
                PlayListParent: 0, PlayListSQL: "", passcode: "", Visible: 1,
            }])
            .mockReturnValueOnce([])
            .mockImplementationOnce(() => { throw new Error("DB error"); });

        const createRouter = require("../routes/playlists");
        const router = createRouter(settings);
        const app = createPlaylistApp(router, locals);

        const response = await request(app).get("/playlists/1");

        expect(response.status).toBe(200);
        expect(response.body.view).toBe("playlists");
        expect(response.body.options.error).toMatch(/DB error/);
    });

    test("GET /:id filters out game IDs not present in the gameIds map", async () => {
        const locals = baseLocals();
        locals.queryRows
            .mockReturnValueOnce([{
                PlayListID: 1, Logo: "logo", PlayDisplay: "My Playlist", PlayName: "MyPlaylist",
                PlayListParent: 0, PlayListSQL: "SELECT * FROM Games", passcode: "", Visible: 1,
            }])
            .mockReturnValueOnce([])
            .mockReturnValueOnce([{ GameID: 1 }, { GameID: 999 }]);

        const createRouter = require("../routes/playlists");
        const router = createRouter(settings);
        const app = createPlaylistApp(router, locals);

        const response = await request(app).get("/playlists/1");

        expect(response.status).toBe(200);
        expect(response.body.options.items).toHaveLength(2); // goBack + 1 known game
    });

    test("GET /:id applies wheel rotation CSS class when useThumbs is true", async () => {
        settings.media.useThumbs = true;
        const locals = baseLocals();
        locals.globalSettings = { thumbRotation: 180 };
        locals.queryRows
            .mockReturnValueOnce([{
                PlayListID: 1, Logo: "logo", PlayDisplay: "My Playlist", PlayName: "MyPlaylist",
                PlayListParent: 0, PlayListSQL: "SELECT * FROM Games", passcode: "", Visible: 1,
            }])
            .mockReturnValueOnce([])
            .mockReturnValueOnce([{ GameID: 1 }]);

        const createRouter = require("../routes/playlists");
        const router = createRouter(settings);
        const app = createPlaylistApp(router, locals);

        const response = await request(app).get("/playlists/1");

        expect(response.status).toBe(200);
        expect(response.body.options.items[1].cssClass).toBe("rotate180");
    });

    test("GET /:id goBack item uses thumbnail src when useThumbs is true", async () => {
        settings.media.useThumbs = true;
        const locals = baseLocals();
        locals.queryRows
            .mockReturnValueOnce([{
                PlayListID: 1, Logo: "logo", PlayDisplay: "My Playlist", PlayName: "MyPlaylist",
                PlayListParent: 0, PlayListSQL: "", passcode: "", Visible: 1,
            }])
            .mockReturnValueOnce([]);

        const createRouter = require("../routes/playlists");
        const router = createRouter(settings);
        const app = createPlaylistApp(router, locals);

        const response = await request(app).get("/playlists/1");

        expect(response.status).toBe(200);
        expect(response.body.options.items[0].goBack).toBe(true);
        expect(response.body.options.items[0].src).toContain("goback_thumb.png");
    });
});
