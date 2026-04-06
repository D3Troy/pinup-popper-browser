"use strict";
var express = require("express");
function createRouter(settings) {
  var router = express.Router();

  /* Root: redirect based on defaultView setting. */
  router.get("/", function (req, res) {
    switch (settings.options && settings.options.defaultView) {
      case "playlists":
        return res.redirect("/playlists");
      case "home":
      default:
        return res.redirect("/home");
    }
  });

  /* GET home page. */
  router.get("/home", function (req, res) {
    let categories, themes, types, decades, manufacturers, emulators;
    if (settings.options.filters.category) {
      categories = filterAndSort(
        req.app.locals.games.map((item) => item.category)
      );
    }
    if (settings.options.filters.theme) {
      themes = filterAndSort(req.app.locals.games.map((item) => item.theme));
    }
    if (settings.options.filters.type) {
      types = filterAndSort(req.app.locals.games.map((item) => item.type));
    }
    if (settings.options.filters.decade) {
      decades = filterAndSort(req.app.locals.games.map((item) => item.decade));
    }
    if (settings.options.filters.manufacturer) {
      manufacturers = filterAndSort(
        req.app.locals.games.map((item) => item.manufacturer)
      );
    }
    if (settings.options.filters.emulator) {
      emulators = filterAndSort(
        req.app.locals.games.map((item) => item.emulator.name)
      );
    }
    res.render("index", {
      games: req.app.locals.games,
      categories: categories,
      types: types,
      themes: themes,
      decades: decades,
      manufacturers: manufacturers,
      emulators: emulators,
      favorites: settings.options.filters.favorites,
      wheelRotation: settings.media.useThumbs
        ? req.app.locals.globalSettings.thumbRotation
        : 0,
    });
  });

  return router;
}

function filterAndSort(map) {
  return map
    .filter((value, index, self) => self.indexOf(value) === index)
    .sort();
}

module.exports = createRouter;
