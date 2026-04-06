"use strict";
var express = require("express");
var crypto = require("crypto");

function timeSlot(cacheMinutes) {
    return Math.floor(Date.now() / (cacheMinutes * 60 * 1000));
}

function computeToken(id, passCode, slot) {
    return crypto.createHash("sha256").update(id + ":" + passCode + ":" + slot).digest("hex");
}

function isValidToken(token, id, passCode, cacheMinutes) {
    var slot = timeSlot(cacheMinutes);
    // Accept current slot and the previous one to handle boundary edge cases
    return token === computeToken(id, passCode, slot) ||
           token === computeToken(id, passCode, slot - 1);
}

function getCookie(req, name) {
    var header = req.headers.cookie || "";
    var found = null;
    header.split(";").forEach(function (part) {
        var idx = part.indexOf("=");
        if (idx < 0) return;
        var key = part.slice(0, idx).trim();
        if (key === name) {
            found = decodeURIComponent(part.slice(idx + 1).trim());
        }
    });
    return found;
}
function createRouter(settings) {
    var router = express.Router();
    var homeUrl = (settings.options && settings.options.defaultView === "playlists")
        ? "/playlists"
        : "/home";
    var cacheMinutes = (settings.media && settings.media.cacheInMinutes) || 20;

    // Passcode unlock
    router.post("/:id/unlock", function (req, res) {
        var id = parseInt(req.params.id, 10);
        if (isNaN(id)) return res.redirect("/playlists");

        var parentRows = req.app.locals.queryRows(
            "SELECT * FROM Playlists WHERE PlayListID = " + id
        );
        if (!parentRows.length) return res.redirect("/playlists");

        var parent = mapPlaylist(parentRows[0]);
        var pin = (req.body.pin || "").toString().trim();

        if (pin === parent.passCode) {
            var token = computeToken(id, parent.passCode, timeSlot(cacheMinutes));
            res.cookie("pl_" + id, token, {
                maxAge: cacheMinutes * 60 * 1000,
                httpOnly: true,
                sameSite: "lax",
            });
            return res.redirect("/playlists/" + id);
        }

        return res.render("playlist_lock", {
            playlistId: id,
            display: parent.display,
            homeUrl: homeUrl,
            error: "Incorrect PIN. Please try again.",
        });
    });

    // Top-level playlists
    router.get("/", function (req, res) {
        var useThumbs = !!(settings.media && settings.media.useThumbs);
        var rotation = getWheelRotation(req, settings);
        var items = getPlaylists(req, 0).map(function (pl) {
            return toPlaylistItem(pl, useThumbs, rotation);
        });
        res.render("playlists", {
            items: items,
            homeUrl: homeUrl,
        });
    });

    // Drill into a playlist: show children or games
    router.get("/:id", function (req, res) {
        var id = parseInt(req.params.id, 10);
        if (isNaN(id)) return res.redirect("/playlists");

        var parentRows = req.app.locals.queryRows(
            "SELECT * FROM Playlists WHERE PlayListID = " + id
        );
        if (!parentRows.length) return res.redirect("/playlists");

        var parent = mapPlaylist(parentRows[0]);

        // Passcode check
        if (parent.passCode) {
            var cookieToken = getCookie(req, "pl_" + id);
            if (!isValidToken(cookieToken, id, parent.passCode, cacheMinutes)) {
                return res.render("playlist_lock", {
                    playlistId: id,
                    display: parent.display,
                    homeUrl: homeUrl,
                    error: null,
                });
            }
        }
        var rotation = getWheelRotation(req, settings);
        var useThumbs = !!(settings.media && settings.media.useThumbs);
        var children = getPlaylists(req, id);
        var backUrl = parent.parent > 0 ? "/playlists/" + parent.parent : "/playlists";
        var goBack = toGoBackItem(backUrl, useThumbs);

        if (children.length > 0) {
            var items = [goBack].concat(children.map(function (pl) {
                return toPlaylistItem(pl, useThumbs, rotation);
            }));
            return res.render("playlists", {
                items: items,
                homeUrl: homeUrl,
            });
        }

        // Leaf node — run the playlist SQL to get games, or fall back to PlayListDetails
        var games = [];
        var error = null;

        if (parent.gameSQL) {
            try {
                var rows = req.app.locals.queryRows(parent.gameSQL);
                games = rows
                    .map(function (row) {
                        var idx = req.app.locals.gameIds.get(parseInt(row.GameID, 10));
                        return idx !== undefined ? req.app.locals.games[idx] : null;
                    })
                    .filter(Boolean);
            } catch (err) {
                error = "Could not load games: " + err.message;
            }
        } else {
            try {
                var detailRows = req.app.locals.queryRows(
                    "SELECT GameID FROM PlayListDetails WHERE PlayListID = " + id
                );
                games = detailRows
                    .map(function (row) {
                        var idx = req.app.locals.gameIds.get(parseInt(row.GameID, 10));
                        return idx !== undefined ? req.app.locals.games[idx] : null;
                    })
                    .filter(Boolean);
            } catch (err) {
                error = "Could not load games: " + err.message;
            }
        }

        var items = [goBack].concat(games.map(function (game) {
            return toGameItem(game, id, rotation, req);
        }));

        res.render("playlists", {
            items: items,
            homeUrl: homeUrl,
            error: error,
        });
    });

    function toGoBackItem(backUrl, useThumbs) {
        return {
            link: backUrl,
            display: "Go Back",
            src: useThumbs
                ? "/media/playlists/pthumbs/goback_thumb.png"
                : "/media/playlists/goback.png",
            placeholder: "/images/wheel_loading_0.gif",
            cssClass: "",
            favorite: false,
        };
    }

    function toPlaylistItem(pl, useThumbs, rotation) {
        return {
            link: "/playlists/" + pl.id,
            display: pl.display,
            src: useThumbs
                ? "/media/playlists/pthumbs/" + encodeURIComponent(pl.logo) + "_thumb.png"
                : "/media/playlists/" + encodeURIComponent(pl.logo) + ".png",
            placeholder: "/images/wheel_loading_" + rotation + ".gif",
            cssClass: "",
            favorite: false,
        };
    }

    function toGameItem(game, playlistId, rotation, req) {
        return {
            link: "/games/" + game.id + "?playlist=" + playlistId,
            display: game.display,
            src: req.app.locals.getWheelSrc(game),
            placeholder: "/images/wheel_loading_" + rotation + ".gif",
            cssClass: rotation ? "rotate" + rotation : "",
            favorite: !!game.favorite,
        };
    }

    function getPlaylists(req, parentId) {
        var rows = req.app.locals.queryRows(
            "SELECT * FROM Playlists WHERE PlayListParent = " +
            parentId +
            " AND Visible = 1 ORDER BY PlayListID"
        );
        return rows.map(mapPlaylist);
    }

    function mapPlaylist(row) {
        return {
            id: row.PlayListID,
            logo: row.Logo || "",
            display: row.PlayDisplay || row.PlayName || "",
            parent: row.PlayListParent,
            gameSQL: row.PlayListSQL || "",
            passCode: (row.passcode && row.passcode.toString()) || "",
        };
    }


    function getWheelRotation(req, cfg) {
        if (cfg.media && cfg.media.useThumbs) {
            return req.app.locals.globalSettings.thumbRotation || 0;
        }
        return 0;
    }

    return router;
}

module.exports = createRouter;
