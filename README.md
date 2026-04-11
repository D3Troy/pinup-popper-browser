# Pinup Popper Browser

> A companion application to [Pinup Popper](http://www.nailbuster.com/wikipinup/) that allows you to browse the available games from another device.

This is an application powered by Node.js with Express to provide a view into your Pinup Popper system from any web browser on your internal network. It works by querying the PuP database to load the details of the games that have been configured, and presents them in a format that can be easily scrolled, filtered, or searched. The selected game can also be launched remotely from the app, which is enabled through the use of the [Web Remote Control for Pinup Popper](http://www.nailbuster.com/wikipinup/doku.php?id=web_remote_control).

## Fork Notes

This repository is a fork of the original `pinup-popper-browser` project with additional UI, playlist, media, and settings features.

Credit goes to the original creator, [doogie2301](https://github.com/doogie2301), for the original project and foundation this fork builds on:

- Original project: https://github.com/doogie2301/pinup-popper-browser

[![Build Status](https://github.com/d3troy/pinup-popper-browser/actions/workflows/ci.yml/badge.svg)](https://github.com/d3troy/pinup-popper-browser/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/d3troy/pinup-popper-browser/branch/master/graph/badge.svg)](https://codecov.io/gh/d3troy/pinup-popper-browser)
[![Dependabot](https://img.shields.io/github/dependabot-status/d3troy/pinup-popper-browser?logo=dependabot)](https://github.com/d3troy/pinup-popper-browser/network/updates)

## Features

- **Main View** - Displays the Wheel images for all games in the Pinup Popper menu. Clicking on a wheel will go to the Game View for that game.

  ![main](docs/images/light-mode.png)

  - **Game Select** - Jumps to the Game View for a specific game
    - **Current Game\*** - The game currently in view in the Pinup Popper menu or the game currently being played.
    - **Last Played\*** - The game that was last played
    - **Random Game** - A randomly selected game
  - **Filters** - The game list can be filtered by one of the following fields: Category, Theme, Type, Decade, Emulator, Manufacturer, and Favorites.
  - **Search Box** - Filters the games by name containing the entered text

- **Game View** - Displays the details for a single game

  ![game](docs/images/game-view.png)

  - **Summary** - Disaplays the wheel image and basic information about the game
    - **Launch Game\*** - Launches the game in Pinup Popper
    - **Exit Current Game\*** - Exits the current game in Pinup Popper
  - **Info** - Displays any images starting with the game name from the GameInfo media folder
  - **Help** - Displays any images starting with the gaame name from the GameHelp media folder
  - **Playfield** - Displays an image or video with the game name from the Playfield media folder

## Additional Features In This Fork

- **Themes: Light and Dark**
  Adds a light theme and a dark theme with a single-button theme toggle in the navbar.

  ![light-dark-mode](docs/images/light-dark-mode.gif)

- **Upgraded to Bootstrap 5**
  Modernizes the UI stack and enables newer responsive layout and component behavior.

- **Added Bootstrap Icons**
  Adds a consistent icon set across navigation, actions, ratings, and media controls.

- **Added Playlists View**
  Adds a dedicated playlists browser with nested playlists, locked playlists, and a visual `Go Back` tile.

  ![playlists-view](docs/images/playlists-view.png)

- **More responsive design for mobile devices**
  Improves navigation, game actions, media layouts, and settings behavior on smaller screens.

- **Favorites can be toggled directly in the game view**
  Lets you mark and unmark favorites without returning to the main grid.

- **Ratings can be changed directly in the game view**
  Lets you update game ratings directly from the summary section.

- **Added direct Web Link action in the game view**
  Opens the configured game URL directly from the game summary.

- **Added Highscore tab support**
  Displays matching images from the configured highscore media folder.

- **Added Media Overview tab**
  Shows Topper, BackGlass, Full DMD, DMD, Playfield, GameInfo, and GameHelp together in one responsive media dashboard.

- **Added built-in Settings page**
  Adds a web-based settings UI for editing app behavior without manually changing `config.yml`.

- **Added drag-and-drop ordering for game fields**
  Lets you reorder visible metadata fields from the Settings page.

- **Added configurable default view**
  Lets you choose whether the app opens on `home` or `playlists`.

- **Added configurable media folder mappings**
  Lets you map media slots to custom Pinup Popper media folders, including `highscore`.

## Setup

### Prerequisites

Features with an asterisk above require the following steps:

- [Enable Web Remote Control for Pinup Popper](http://www.nailbuster.com/wikipinup/doku.php?id=web_remote_control)
- Add the following line of code inside the GameLaunch(pMsg) method inside the PuPMenuScript.pup file (needed for the Current Game feature to work after game is launched):

       if (useWEB && WEBStatus) { PuPWebServer.MenuUpdate(pMsg); }

  Example:

  ![alt tag](https://user-images.githubusercontent.com/12683011/83413297-9a521700-a3e9-11ea-9642-dc5fe37ad381.png)

### Installation

#### Using Node

Requires Node.js 18 or newer.

If you already have Node installed, you can download the source code and run the following commands:

    npm install
    node .

The advantage to this approach is that you have the ability to customize the code.

#### Running without Node

The application is also packaged as a standalone executable. This option does not require Node.js to be installed. Simply download and extract the contents of the latest PinUpBrowser.zip file from [the Releases tab](https://github.com/d3troy/pinup-popper-browser/releases), and run the PinUpBrowser.exe executable.

### Configuration

The config.yml file contains settings that can be modified to support your setup and adjust preferences. Changes will take effect after the application is restarted.

* **pupServer.url**
  
  Specify the URL for the PuPServer.

* **pupServer.db.path**
  
  Specify the full path to the Pinup database.

* **pupServer.db.filter**

  An optional condition used in the WHERE clause to filter the initial load of games.

* **httpServer.port**

  Specify the port number for this web host.

* **httpServer.logFormat**

  Format for debug logging (see https://github.com/expressjs/morgan#predefined-formats)

* **httpServer.logLevel**

  Set to 'error' to only log failed requests, or 'info' to log all requests.

* **options.kioskMode**

  Hides settings access from the main UI.

* **options.defaultView**

  Sets the default landing page for `/` to `home` or `playlists`.

* **options.filters**

  The filter menu options can be enabled/disabled individually.

  - `options.filters.category`
  - `options.filters.theme`
  - `options.filters.type`
  - `options.filters.decade`
  - `options.filters.emulator`
  - `options.filters.manufacturer`
  - `options.filters.favorites`

* **options.game**

  The Info, Help, Playfield, and Highscore menu options can be enabled/disabled individually.

  - `options.game.info`
  - `options.game.help`
  - `options.game.playfield`
  - `options.game.highscore`

* **options.game.media**

  Enable or disable slots in the Media Overview tab.

  - `options.game.media.topper`
  - `options.game.media.backglass`
  - `options.game.media.fulldmd`
  - `options.game.media.dmd`
  - `options.game.media.playfield`
  - `options.game.media.help`
  - `options.game.media.info`

* **options.dateFormat**

  Controls how dates are displayed in the game view and settings preview.

* **options.gameFields**

  Controls which metadata fields are shown in the game summary and in what order.

  Available fields:

  - `year`
  - `type`
  - `manufacturer`
  - `numPlayers`
  - `emulator`
  - `category`
  - `theme`
  - `rating`
  - `lastPlayed`
  - `numPlays`
  - `timePlayed`
  - `designedBy`
  - `webLinkUrl`
  - `gameVersion`
  - `gameDescription`
  - `romName`
  - `tableType`

* **media.useThumbs**

  Indicates whether to use the thumbnail images created by Pinup Popper for display. Turning this off will load the full sized Wheel media, which may slow the load time and browser responsiveness, but will not require the games to have been viewed in the Pinup Popper menu first.

* **media.cacheInMinutes**

  The number of minutes the browser should cache the media files.

* **media.playfieldRotation**

  Indicates whether Playfield media is rotated or not.

* **media.folders**

  Folder mapping for media lookup. This fork supports configuring `topper`, `backglass`, `fulldmd`, `dmd`, `playfield`, `help`, `info`, and `highscore`.

  - `media.folders.topper`
  - `media.folders.backglass`
  - `media.folders.fulldmd`
  - `media.folders.dmd`
  - `media.folders.playfield`
  - `media.folders.help`
  - `media.folders.info`
  - `media.folders.highscore`

### Settings UI

Most of the options above can also be managed directly from the built-in `/settings` page.

## Support

Bugs reports and enhancement requests can be submitted by [creating an  issue](https://github.com/d3troy/pinup-popper-browser/issues?q=is%3Aopen+is%3Aissue).

## Sponsoring

This project is a contribution to the virtual pinball community, and is completely free to use. If you would like to support this fork, you can use the button below. 

<a href="https://www.buymeacoffee.com/d3troy" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/lato-black.png" alt="Buy Me A Coffee" height="35"></a>

Please also consider sponsoring doogie for the original project this fork is based on.

<a href="https://www.buymeacoffee.com/doogie2301" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/lato-black.png" alt="Buy Me A Coffee" height="35"></a>

## License

This project is licensed under the terms of the GPL-3.0 license.
