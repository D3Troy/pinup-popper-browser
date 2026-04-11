"use strict";

const express = require("express");
const request = require("supertest");

function createSettingsApp(router, locals) {
    const app = express();
    app.use(express.urlencoded({ extended: false }));

    app.locals.games = locals.games || [];
    app.locals.gameIds = locals.gameIds || new Map();
    app.locals.globalSettings = locals.globalSettings || { thumbRotation: 0 };
    app.locals.queryRows = locals.queryRows || jest.fn().mockReturnValue([]);
    app.locals.getWheelSrc = locals.getWheelSrc || (() => "/wheel.png");
    app.locals.gameFields = locals.gameFields;

    app.use((req, res, next) => {
        res.render = (view, options) => {
            res.json({ view, options });
        };
        next();
    });

    app.use("/settings", router);
    return app;
}

function baseSettings() {
    return {
        pupServer: { url: "http://localhost" },
        options: {
            defaultView: "home",
            dateFormat: "dd/MM/yyyy",
            filters: {},
            game: { info: true, help: true, playfield: true, highscore: false, media: {} },
            gameFields: [],
        },
        media: {
            useThumbs: false,
            playfieldRotation: false,
            cacheInMinutes: 60,
            folders: {},
        },
    };
}

function baseLocals() {
    return {
        games: [
            { id: 1, name: "Attack From Mars" },
            { id: 2, name: "The Addams Family" },
        ],
        gameIds: new Map([[1, 0], [2, 1]]),
        globalSettings: { thumbRotation: 90 },
        queryRows: jest.fn().mockReturnValue([]),
        getWheelSrc: (g) => `/wheels/${g.id}.png`,
        gameFields: ["year", "manufacturer"],
    };
}

describe("routes/settings", () => {
    let mockWriteFile;
    let mockResolveConfigPath;
    let settings;

    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();

        mockWriteFile = jest.fn().mockResolvedValue(undefined);
        mockResolveConfigPath = jest.fn().mockResolvedValue("/config.yml");

        jest.doMock("node:fs/promises", () => ({ writeFile: mockWriteFile }));
        jest.doMock("../settings", () => ({ resolveConfigPath: mockResolveConfigPath }));

        settings = baseSettings();
    });

    // ── GET / ──────────────────────────────────────────────────────────────────

    test("GET /settings renders settings page with correct fields", async () => {
        const createRouter = require("../routes/settings");
        const router = createRouter(settings);
        const app = createSettingsApp(router, baseLocals());

        const response = await request(app).get("/settings");

        expect(response.status).toBe(200);
        expect(response.body.view).toBe("settings");
        expect(response.body.options.cfg).toEqual(settings);
        expect(response.body.options.allFields).toContain("year");
        expect(response.body.options.allFields).toContain("rating");
        expect(response.body.options.isSettingsPage).toBe(true);
    });

    test("GET /settings passes gameFields from app.locals", async () => {
        const createRouter = require("../routes/settings");
        const router = createRouter(settings);
        const app = createSettingsApp(router, baseLocals());

        const response = await request(app).get("/settings");

        expect(response.body.options.gameFields).toEqual(["year", "manufacturer"]);
    });

    test("GET /settings picks a previewGame and wheelSrc from games list", async () => {
        const createRouter = require("../routes/settings");
        const router = createRouter(settings);
        const app = createSettingsApp(router, baseLocals());

        const response = await request(app).get("/settings");

        expect(response.body.options.previewGame).not.toBeNull();
        expect(response.body.options.wheelSrc).toMatch(/^\/wheels\/\d+\.png$/);
    });

    test("GET /settings sets previewGame and wheelSrc to null when no games", async () => {
        const locals = baseLocals();
        locals.games = [];

        const createRouter = require("../routes/settings");
        const router = createRouter(settings);
        const app = createSettingsApp(router, locals);

        const response = await request(app).get("/settings");

        expect(response.body.options.previewGame).toBeNull();
        expect(response.body.options.wheelSrc).toBeNull();
    });

    test("GET /settings wheelRotation is thumbRotation when useThumbs is true", async () => {
        settings.media.useThumbs = true;
        const locals = baseLocals();
        locals.globalSettings.thumbRotation = 180;

        const createRouter = require("../routes/settings");
        const router = createRouter(settings);
        const app = createSettingsApp(router, locals);

        const response = await request(app).get("/settings");

        expect(response.body.options.wheelRotation).toBe(180);
    });

    test("GET /settings wheelRotation is 0 when useThumbs is false", async () => {
        settings.media.useThumbs = false;

        const createRouter = require("../routes/settings");
        const router = createRouter(settings);
        const app = createSettingsApp(router, baseLocals());

        const response = await request(app).get("/settings");

        expect(response.body.options.wheelRotation).toBe(0);
    });

    test("GET /settings homeSamples contains wheel URLs capped at 18", async () => {
        const locals = baseLocals();
        locals.games = Array.from({ length: 25 }, (_, i) => ({ id: i + 1, name: `Game ${i + 1}` }));

        const createRouter = require("../routes/settings");
        const router = createRouter(settings);
        const app = createSettingsApp(router, locals);

        const response = await request(app).get("/settings");

        expect(response.body.options.homeSamples).toHaveLength(18);
        expect(response.body.options.homeSamples[0]).toMatch(/^\/wheels\//);
    });

    test("GET /settings playlistSamples uses thumb URLs when useThumbs is true", async () => {
        settings.media.useThumbs = true;
        const locals = baseLocals();
        locals.queryRows = jest.fn().mockReturnValue([
            { Logo: "MyPlaylist" },
            { Logo: "Another" },
        ]);

        const createRouter = require("../routes/settings");
        const router = createRouter(settings);
        const app = createSettingsApp(router, locals);

        const response = await request(app).get("/settings");

        expect(response.body.options.playlistSamples[0]).toContain("pthumbs");
        expect(response.body.options.playlistSamples[0]).toContain("_thumb.png");
    });

    test("GET /settings playlistSamples uses regular URLs when useThumbs is false", async () => {
        settings.media.useThumbs = false;
        const locals = baseLocals();
        locals.queryRows = jest.fn().mockReturnValue([{ Logo: "MyPlaylist" }]);

        const createRouter = require("../routes/settings");
        const router = createRouter(settings);
        const app = createSettingsApp(router, locals);

        const response = await request(app).get("/settings");

        expect(response.body.options.playlistSamples[0]).toContain("/media/playlists/");
        expect(response.body.options.playlistSamples[0]).not.toContain("pthumbs");
        expect(response.body.options.playlistSamples[0]).toMatch(/\.png$/);
    });

    test("GET /settings playlistSamples capped at 18", async () => {
        const locals = baseLocals();
        locals.queryRows = jest.fn().mockReturnValue(
            Array.from({ length: 25 }, (_, i) => ({ Logo: `list${i}` }))
        );

        const createRouter = require("../routes/settings");
        const router = createRouter(settings);
        const app = createSettingsApp(router, locals);

        const response = await request(app).get("/settings");

        expect(response.body.options.playlistSamples).toHaveLength(18);
    });

    test("GET /settings playlistSamples handles missing Logo", async () => {
        settings.media.useThumbs = false;
        const locals = baseLocals();
        locals.queryRows = jest.fn().mockReturnValue([{ Logo: null }]);

        const createRouter = require("../routes/settings");
        const router = createRouter(settings);
        const app = createSettingsApp(router, locals);

        const response = await request(app).get("/settings");

        expect(response.body.options.playlistSamples[0]).toContain("/media/playlists/");
    });

    test("GET /settings dateFormatExample applies token substitution for custom format", async () => {
        settings.options.dateFormat = "dd/MM/yyyy";

        const createRouter = require("../routes/settings");
        const router = createRouter(settings);
        const app = createSettingsApp(router, baseLocals());

        const response = await request(app).get("/settings");

        // Should be formatted like "15/04/2026", not the raw format string
        expect(response.body.options.dateFormatExample).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
    });

    test("GET /settings dateFormatExample falls back to toLocaleString for non-token format", async () => {
        settings.options.dateFormat = "medium";

        const createRouter = require("../routes/settings");
        const router = createRouter(settings);
        const app = createSettingsApp(router, baseLocals());

        const response = await request(app).get("/settings");

        // toLocaleString() returns a non-empty string
        expect(typeof response.body.options.dateFormatExample).toBe("string");
        expect(response.body.options.dateFormatExample.length).toBeGreaterThan(0);
    });

    // ── POST / ─────────────────────────────────────────────────────────────────

    test("POST /settings saves YAML to config path and redirects to /", async () => {
        const createRouter = require("../routes/settings");
        const router = createRouter(settings);
        const app = createSettingsApp(router, baseLocals());

        const response = await request(app)
            .post("/settings")
            .type("form")
            .send({ defaultView: "home" });

        expect(response.status).toBe(302);
        expect(response.headers.location).toBe("/");
        expect(mockWriteFile).toHaveBeenCalledWith("/config.yml", expect.any(String), "utf8");
    });

    test("POST /settings redirects to /playlists when defaultView is playlists", async () => {
        const createRouter = require("../routes/settings");
        const router = createRouter(settings);
        const app = createSettingsApp(router, baseLocals());

        const response = await request(app)
            .post("/settings")
            .type("form")
            .send({ defaultView: "playlists" });

        expect(response.status).toBe(302);
        expect(response.headers.location).toBe("/playlists");
    });

    test("POST /settings updates defaultView and dateFormat on settings", async () => {
        const createRouter = require("../routes/settings");
        const router = createRouter(settings);
        const app = createSettingsApp(router, baseLocals());

        await request(app)
            .post("/settings")
            .type("form")
            .send({ defaultView: "playlists", dateFormat: "MM-dd-yyyy" });

        expect(settings.options.defaultView).toBe("playlists");
        expect(settings.options.dateFormat).toBe("MM-dd-yyyy");
    });

    test("POST /settings keeps existing dateFormat when none provided", async () => {
        settings.options.dateFormat = "dd/MM/yyyy";

        const createRouter = require("../routes/settings");
        const router = createRouter(settings);
        const app = createSettingsApp(router, baseLocals());

        await request(app).post("/settings").type("form").send({});

        expect(settings.options.dateFormat).toBe("dd/MM/yyyy");
    });

    test("POST /settings parses filter checkboxes correctly", async () => {
        const createRouter = require("../routes/settings");
        const router = createRouter(settings);
        const app = createSettingsApp(router, baseLocals());

        await request(app)
            .post("/settings")
            .type("form")
            .send({
                "filters.category": "on",
                "filters.favorites": "on",
            });

        expect(settings.options.filters.category).toBe(true);
        expect(settings.options.filters.favorites).toBe(true);
        expect(settings.options.filters.theme).toBe(false);
        expect(settings.options.filters.emulator).toBe(false);
    });

    test("POST /settings parses game section checkboxes correctly", async () => {
        const createRouter = require("../routes/settings");
        const router = createRouter(settings);
        const app = createSettingsApp(router, baseLocals());

        await request(app)
            .post("/settings")
            .type("form")
            .send({
                "game.info": "on",
                "game.playfield": "on",
                "game.media.backglass": "on",
                "game.media.playfield": "on",
            });

        expect(settings.options.game.info).toBe(true);
        expect(settings.options.game.playfield).toBe(true);
        expect(settings.options.game.help).toBe(false);
        expect(settings.options.game.media.backglass).toBe(true);
        expect(settings.options.game.media.playfield).toBe(true);
        expect(settings.options.game.media.topper).toBe(false);
        expect(settings.options.game.media.dmd).toBe(false);
    });

    test("POST /settings parses media settings correctly", async () => {
        const createRouter = require("../routes/settings");
        const router = createRouter(settings);
        const app = createSettingsApp(router, baseLocals());

        await request(app)
            .post("/settings")
            .type("form")
            .send({
                "media.useThumbs": "on",
                "media.playfieldRotation": "on",
                "media.cacheInMinutes": "30",
            });

        expect(settings.media.useThumbs).toBe(true);
        expect(settings.media.playfieldRotation).toBe(true);
        expect(settings.media.cacheInMinutes).toBe(30);
    });

    test("POST /settings keeps existing cacheInMinutes when value is not a number", async () => {
        settings.media.cacheInMinutes = 120;

        const createRouter = require("../routes/settings");
        const router = createRouter(settings);
        const app = createSettingsApp(router, baseLocals());

        await request(app)
            .post("/settings")
            .type("form")
            .send({ "media.cacheInMinutes": "abc" });

        expect(settings.media.cacheInMinutes).toBe(120);
    });

    test("POST /settings sets custom folder slot values", async () => {
        const createRouter = require("../routes/settings");
        const router = createRouter(settings);
        const app = createSettingsApp(router, baseLocals());

        await request(app)
            .post("/settings")
            .type("form")
            .send({
                "media.folders.topper": "MyTopper",
                "media.folders.backglass": "MyBackglass",
            });

        expect(settings.media.folders.topper).toBe("MyTopper");
        expect(settings.media.folders.backglass).toBe("MyBackglass");
    });

    test("POST /settings ignores blank folder slot values", async () => {
        settings.media.folders = { topper: "OldTopper" };

        const createRouter = require("../routes/settings");
        const router = createRouter(settings);
        const app = createSettingsApp(router, baseLocals());

        await request(app)
            .post("/settings")
            .type("form")
            .send({ "media.folders.topper": "   " });

        expect(settings.media.folders.topper).toBe("OldTopper");
    });

    test("POST /settings handles gameFields as array", async () => {
        const createRouter = require("../routes/settings");
        const router = createRouter(settings);
        const locals = baseLocals();
        const app = createSettingsApp(router, locals);

        await request(app)
            .post("/settings")
            .type("form")
            .send("gameFields=year&gameFields=manufacturer");

        expect(settings.options.gameFields).toEqual(["year", "manufacturer"]);
        expect(app.locals.gameFields).toEqual(["year", "manufacturer"]);
    });

    test("POST /settings handles gameFields as single value", async () => {
        const createRouter = require("../routes/settings");
        const router = createRouter(settings);
        const app = createSettingsApp(router, baseLocals());

        await request(app)
            .post("/settings")
            .type("form")
            .send({ gameFields: "year" });

        expect(settings.options.gameFields).toEqual(["year"]);
    });

    test("POST /settings handles missing gameFields as empty array", async () => {
        const createRouter = require("../routes/settings");
        const router = createRouter(settings);
        const app = createSettingsApp(router, baseLocals());

        await request(app).post("/settings").type("form").send({});

        expect(settings.options.gameFields).toEqual([]);
    });

    test("POST /settings updates app.locals.dateFormat", async () => {
        const createRouter = require("../routes/settings");
        const router = createRouter(settings);
        const app = createSettingsApp(router, baseLocals());

        await request(app)
            .post("/settings")
            .type("form")
            .send({ dateFormat: "yyyy-MM-dd" });

        expect(app.locals.dateFormat).toBe("yyyy-MM-dd");
    });

    test("POST /settings initializes folders object if missing", async () => {
        delete settings.media.folders;

        const createRouter = require("../routes/settings");
        const router = createRouter(settings);
        const app = createSettingsApp(router, baseLocals());

        await request(app)
            .post("/settings")
            .type("form")
            .send({ "media.folders.playfield": "CustomPlayfield" });

        expect(settings.media.folders.playfield).toBe("CustomPlayfield");
    });

    test("POST /settings writes valid YAML to the config file", async () => {
        const YAML = require("yaml");

        const createRouter = require("../routes/settings");
        const router = createRouter(settings);
        const app = createSettingsApp(router, baseLocals());

        await request(app)
            .post("/settings")
            .type("form")
            .send({ defaultView: "home", "media.useThumbs": "on" });

        const written = mockWriteFile.mock.calls[0][1];
        const parsed = YAML.parse(written);
        expect(parsed).toBeTruthy();
        expect(parsed.media.useThumbs).toBe(true);
    });
});
