function applyFavFromStorage() {
  for (var i = 0; i < sessionStorage.length; i++) {
    var key = sessionStorage.key(i);
    if (!key || !key.startsWith("fav_")) continue;
    var gid = key.slice(4);
    var val = parseInt(sessionStorage.getItem(key), 10);
    document.querySelectorAll(".favorite[data-gameid='" + gid + "']").forEach(function (s) {
      s.dataset.fav = val;
      s.classList.toggle("bi-star-fill", !!val);
      s.classList.toggle("bi-star", !val);
      var gameDiv = s.closest(".game");
      if (gameDiv) gameDiv.dataset.fav = val;
    });
  }
}

window.addEventListener("pageshow", function (e) {
  if (e.persisted) applyFavFromStorage();
});

document.addEventListener("DOMContentLoaded", function () {
  document.querySelectorAll('[data-lastplayed]').forEach(function(el) {
    var raw = el.getAttribute('data-lastplayed');
    var dateFormat = el.getAttribute('data-dateformat');
    var locale = el.getAttribute('data-locale') || undefined;
    function pad(n, l=2) { return n.toString().padStart(l, '0'); }
    if (raw && !isNaN(Date.parse(raw))) {
      var date = new Date(raw);
      if (dateFormat && /[dMyHhms]/.test(dateFormat)) {
        // Simple pattern replacement: dd.MM.yyyy HH.mm
        var map = {
          dd: pad(date.getDate()),
          MM: pad(date.getMonth()+1),
          yyyy: date.getFullYear(),
          HH: pad(date.getHours()),
          mm: pad(date.getMinutes()),
          ss: pad(date.getSeconds()),
        };
        var out = dateFormat.replace(/dd|MM|yyyy|HH|mm|ss/g, function(k){return map[k]||k;});
        el.textContent = out;
      } else {
        el.textContent = date.toLocaleString(locale, dateFormat ? { dateStyle: dateFormat, timeStyle: dateFormat } : undefined);
      }
    } else {
      el.textContent = raw || '';
    }
  });
  lazyload();

  document.addEventListener("click", function (e) {
    var star = e.target.closest(".favorite[data-gameid]");
    if (!star) return;
    e.preventDefault();
    e.stopPropagation();
    var gameId = star.dataset.gameid;
    fetch("/games/" + gameId + "/fav", { method: "POST" })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        sessionStorage.setItem("fav_" + gameId, data.favorite);
        document.querySelectorAll(".favorite[data-gameid='" + gameId + "']").forEach(function (s) {
          s.dataset.fav = data.favorite;
          s.classList.toggle("bi-star-fill", !!data.favorite);
          s.classList.toggle("bi-star", !data.favorite);
          var gameDiv = s.closest(".game");
          if (gameDiv) gameDiv.dataset.fav = data.favorite;
        });
      })
      .catch(function (err) { console.error("fav toggle failed", err); });
  });

  document.addEventListener("click", function (e) {
    var star = e.target.closest(".rating-star");
    if (!star) return;
    var wrap = star.closest(".rating-wrap[data-gameid]");
    if (!wrap) return;
    e.preventDefault();
    var gameId = wrap.dataset.gameid;
    var newRating = parseInt(star.dataset.value, 10);
    var currentRating = parseInt(wrap.dataset.rating, 10);
    if (newRating === currentRating) newRating = 0;
    fetch("/games/" + gameId + "/rating", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "rating=" + newRating,
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        wrap.dataset.rating = data.rating;
        wrap.querySelectorAll(".rating-star").forEach(function (s) {
          var val = parseInt(s.dataset.value, 10);
          s.classList.toggle("bi-star-fill", val <= data.rating);
          s.classList.toggle("bi-star", val > data.rating);
        });
      })
      .catch(function (err) { console.error("rating failed", err); });
  });

  document.addEventListener("pointerover", function (e) {
    if (e.pointerType !== "mouse") return;
    var star = e.target.closest(".rating-star");
    if (!star) return;
    var wrap = star.closest(".rating-wrap");
    if (!wrap) return;
    var hovered = parseInt(star.dataset.value, 10);
    wrap.querySelectorAll(".rating-star").forEach(function (s) {
      var val = parseInt(s.dataset.value, 10);
      s.classList.toggle("preview", val <= hovered);
      s.classList.toggle("bi-star-fill", val <= hovered);
      s.classList.toggle("bi-star", val > hovered);
    });
  });

  document.addEventListener("pointerout", function (e) {
    if (e.pointerType !== "mouse") return;
    var star = e.target.closest(".rating-star");
    if (!star) return;
    var wrap = star.closest(".rating-wrap");
    if (!wrap || wrap.contains(e.relatedTarget)) return;
    var current = parseInt(wrap.dataset.rating, 10);
    wrap.querySelectorAll(".rating-star").forEach(function (s) {
      var val = parseInt(s.dataset.value, 10);
      s.classList.remove("preview");
      s.classList.toggle("bi-star-fill", val <= current);
      s.classList.toggle("bi-star", val > current);
    });
  });

  var htmlEl = document.documentElement;
  var toggleBtn = document.createElement("button");
  toggleBtn.id = "darkModeToggle";
  toggleBtn.type = "button";
  toggleBtn.className = "btn btn-outline-light btn-sm";
  toggleBtn.setAttribute("aria-label", "Toggle dark mode");
  toggleBtn.innerHTML = htmlEl.getAttribute("data-bs-theme") === "dark" ? '<i class="bi bi-sun-fill"></i>' : '<i class="bi bi-moon-stars-fill"></i>';
  toggleBtn.addEventListener("click", function () {
    var next = htmlEl.getAttribute("data-bs-theme") === "dark" ? "light" : "dark";
    htmlEl.setAttribute("data-bs-theme", next);
    localStorage.setItem("theme", next);
    this.innerHTML = next === "dark" ? '<i class="bi bi-sun-fill"></i>' : '<i class="bi bi-moon-stars-fill"></i>';
  });
  var navbarRight = document.getElementById("navbarRight");
  var navbarTarget = navbarRight || document.querySelector(".navbar");
  if (navbarTarget) navbarTarget.appendChild(toggleBtn);

  document.querySelectorAll('[data-bs-toggle="tooltip"]').forEach(function (el) {
    new bootstrap.Tooltip(el);
  });

  var firstTab = document.querySelector("#tabs li:first-child a");
  if (firstTab) { bootstrap.Tab.getOrCreateInstance(firstTab).show(); }

  document.querySelectorAll("img.wheel").forEach(function (img) {
    img.addEventListener("error", function () {
      this.className = this.className.replace(/(^|\s)rotate\S+/g, " ").trim();
      this.src = "/images/unavailable.png";
    });
  });

  var gameEl = document.getElementById("game");
  if (gameEl && location.href.split("/").pop() === "current") {
    var refresh = gameEl.dataset.refresh;
    if (refresh) {
      window.setInterval(function () { location.reload(); }, refresh);
    }
  }

  document.querySelectorAll('a[data-bs-toggle="tab"]').forEach(function (tabEl) {
    tabEl.addEventListener("show.bs.tab", function (e) {
      let target;
      if (e.target.textContent.trim() === "Info") {
        target = "info";
      } else if (e.target.textContent.trim() === "Help") {
        target = "help";
      } else if (e.target.textContent.trim() === "Playfield") {
        target = "playfield";
      } else if (e.target.textContent.trim() === "Highscore") {
        target = "highscore";
      } else if (e.target.textContent.trim() === "Media") {
        var mediaPaneEl = document.getElementById("media");
        if (mediaPaneEl && mediaPaneEl.dataset.loaded) return;
        fetch(gameEl.dataset.gameid + "/media")
          .then(function (r) { return r.status === 200 ? r.json() : {}; })
          .then(function (data) {
            if (document.getElementById("mediaTopper"))    renderMediaSlot("#mediaTopper",    data.topper    || []);
            if (document.getElementById("mediaBackglass")) renderMediaSlot("#mediaBackglass", data.backglass || []);
            if (document.getElementById("mediaDMD"))       renderMediaSlot("#mediaDMD",       data.dmd       || []);
            if (document.getElementById("mediaPlayfield")) renderMediaSlot("#mediaPlayfield", data.playfield || []);
            if (document.getElementById("mediaHelp"))      renderMediaSlot("#mediaHelp",      data.help      || []);
            if (document.getElementById("mediaInfo"))      renderMediaSlot("#mediaInfo",      data.info      || []);
            if (mediaPaneEl) mediaPaneEl.dataset.loaded = "1";
          })
          .catch(function (err) { console.log(err); });
        return;
      }

      if (target) {
        if (target == "playfield") {
          var playfield = document.getElementById("playfield");
          if (playfield.children.length) {
            return;
          }

          fetch(gameEl.dataset.gameid + "/" + target)
            .then((response) => {
              return response.status == 200 ? response.json() : [];
            })
            .then((data) => {
              var elem;
              if (data.length) {
                let rotate = "rotate" in playfield.dataset;
                let src = data[0];
                if (src.endsWith(".png") || src.endsWith(".jpg")) {
                  elem = document.createElement("img");
                  elem.className = rotate ? "playfieldRotate" : "playfield";
                  elem.src = src;
                } else {
                  elem = document.createElement("video");
                  elem.id = "vidPlayfield";
                  elem.className = rotate ? "playfieldRotate" : "playfield";
                  elem.src = data[0];
                  elem.setAttribute("playsinline", "");
                  elem.autoplay = true;
                  elem.loop = true;
                }
              } else {
                elem = document.createElement("img");
                elem.src = "/images/unavailable.png";
              }
              playfield.appendChild(elem);
            })
            .catch((err) => {
              console.log(err);
            });
        } else {
          var carouselInner = document.querySelector("#carousel" + e.target.textContent.trim() + " .carousel-inner");
          if (carouselInner.children.length) {
            return;
          }

          fetch(gameEl.dataset.gameid + "/" + target)
            .then((response) => {
              return response.status == 200 ? response.json() : [];
            })
            .then((data) => {
              if (!data.length) {
                data.push("/images/unavailable.png");
              }
              data.forEach(function (value, i) {
                var div = document.createElement("div");
                div.className = "carousel-item" + (i === 0 ? " active" : "");
                var img = document.createElement("img");
                if (i === 0) img.src = value;
                else img.dataset.src = value;
                div.appendChild(img);
                carouselInner.appendChild(div);
              });
              var carouselEl = document.getElementById("carousel" + e.target.textContent.trim());
              bootstrap.Carousel.getOrCreateInstance(carouselEl).pause();
              if (data.length == 1) {
                carouselEl.querySelectorAll("button[data-bs-slide]").forEach(function (btn) { btn.remove(); });
              }
            })
            .catch((err) => {
              console.log(err);
            });
        }
      }
    });
  });

  function renderMediaSlot(selector, files) {
    var slot = document.querySelector(selector);
    if (!slot) return;
    var src = files.length ? files[0] : "/images/unavailable.png";
    var elem;
    if (src.endsWith(".mp4")) {
      elem = document.createElement("video");
      elem.src = src;
      elem.className = "media-ov-media";
      elem.setAttribute("playsinline", "");
      elem.autoplay = true;
      elem.loop = true;
      elem.muted = true;
    } else {
      elem = document.createElement("img");
      elem.src = src;
      elem.className = "media-ov-media";
    }
    slot.appendChild(elem);
  }

  document.addEventListener("click", function (e) {
    var media = e.target.closest(".media-ov-media");
    if (!media) return;
    var overlay = document.createElement("div");
    overlay.className = "media-fullscreen-overlay";
    var clone;
    if (media.tagName === "VIDEO") {
      clone = document.createElement("video");
      clone.src = media.src;
      clone.setAttribute("playsinline", "");
      clone.autoplay = true;
      clone.loop = true;
      clone.muted = media.muted;
    } else {
      clone = document.createElement("img");
      clone.src = media.src;
    }
    overlay.appendChild(clone);
    document.body.appendChild(overlay);
    overlay.addEventListener("click", function () { overlay.remove(); });
    document.addEventListener("keydown", function onKey(e) {
      if (e.key === "Escape") { overlay.remove(); document.removeEventListener("keydown", onKey); }
    });
  });

  document.querySelectorAll(".carousel").forEach(function (carousel) {
    carousel.addEventListener("slide.bs.carousel", function (e) {
      var upcomingImage = e.relatedTarget.querySelector("img");
      if (upcomingImage && !upcomingImage.getAttribute("src")) {
        upcomingImage.src = upcomingImage.dataset.src;
      }
    });
  });

  document.addEventListener("click", function (e) {
    var navbarCollapse = document.querySelector(".navbar-collapse.show");
    if (navbarCollapse && e.target.matches('a:not([data-bs-toggle]), img')) {
      bootstrap.Collapse.getOrCreateInstance(navbarCollapse).hide();
    }
  });

  var btnBack = document.getElementById("btnBack");
  if (btnBack) {
    btnBack.addEventListener("click", function () {
      var backUrl = this.dataset.backUrl;
      if (backUrl) {
        window.location.href = backUrl;
      } else {
        history.back();
      }
    });
  }

  document.addEventListener("click", function (e) {
    var link = e.target.closest("a[data-go-back='true']");
    if (link) {
      e.preventDefault();
      history.back();
    }
  });

  var btnLaunch = document.getElementById("btnLaunch");
  if (btnLaunch) {
    btnLaunch.addEventListener("click", function () {
      var spinner = document.createElement("span");
      spinner.className = "spinner-border spinner-border-sm ms-1";
      spinner.setAttribute("role", "status");
      spinner.setAttribute("aria-hidden", "true");
      this.appendChild(spinner);
      fetch("/games/" + this.dataset.id + "/launch")
        .then((response) => {
          response.status != 200
            ? showAlert("danger", "Launch request failed")
            : showAlert("success", "Launch request succeeded");
        })
        .catch(() => {
          showAlert("danger", "Launch request failed");
        })
        .finally(() => {
          spinner.remove();
        });
    });
  }

  var btnExit = document.getElementById("btnExit");
  if (btnExit) {
    btnExit.addEventListener("click", function () {
      var spinner = document.createElement("span");
      spinner.className = "spinner-border spinner-border-sm ms-1";
      spinner.setAttribute("role", "status");
      spinner.setAttribute("aria-hidden", "true");
      this.appendChild(spinner);
      fetch("/games/exit")
        .then((response) => {
          response.status != 200
            ? showAlert("danger", "Exit request failed")
            : showAlert("success", "Exit request succeeded");
        })
        .catch(() => {
          showAlert("danger", "Exit request failed");
        })
        .finally(() => {
          spinner.remove();
        });
    });
  }

  function showAlert(type, text) {
    var div = document.createElement("div");
    div.className = "alert alert-" + type;
    div.setAttribute("role", "alert");
    div.innerHTML = text + '<button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>';
    var response = document.getElementById("response");
    if (response) {
      response.appendChild(div);
      setTimeout(function () {
        div.style.transition = "opacity 0.5s";
        div.style.opacity = "0";
        setTimeout(function () { div.remove(); }, 500);
      }, 3000);
    }
  }

  document.querySelectorAll("[data-filter]").forEach(function (el) {
    el.addEventListener("click", function () {
      var type = this.dataset.filter;
      var value = type === "fav" ? "1" : this.textContent.trim();
      filter(type, value);
    });
  });

  function filter(type, value) {
    document.querySelectorAll("#gamesRow div.game").forEach(function (el) {
      el.style.display = el.dataset[type] == value ? "" : "none";
    });
    updateGameCount();
    localStorage.setItem("filterType", type);
    localStorage.setItem("filterValue", value);
    document.getElementById("gameSearch").value = "";
  }

  if (document.querySelector("[data-filter]") && localStorage.getItem("filterType")) {
    var type = localStorage.getItem("filterType");
    var value = localStorage.getItem("filterValue");
    filter(type, value);
  }

  var clearFilter = document.getElementById("clearFilter");
  if (clearFilter) {
    clearFilter.addEventListener("click", function () {
      var gameSearch = document.getElementById("gameSearch");
      gameSearch.value = "";
      search(gameSearch);
      checkFilter();
    });
  }

  function checkFilter() {
    var gameCount = document.getElementById("gameCount");
    var clearFilter = document.getElementById("clearFilter");
    if (gameCount && clearFilter) {
      clearFilter.style.display = gameCount.dataset.total != gameCount.textContent ? "" : "none";
    }
  }

  var observer = new MutationObserver(function () {
    checkFilter();
  });

  var gameCountEl = document.getElementById("gameCount");
  if (gameCountEl) {
    observer.observe(gameCountEl, {
      characterData: true,
      childList: true,
    });
  }

  function updateGameCount() {
    var cnt = document.querySelectorAll(".game:not([style*='display: none'])").length;
    var gameCount = document.getElementById("gameCount");
    if (gameCount) gameCount.textContent = cnt;
  }

  function delay(callback, ms) {
    var timer = 0;
    return function () {
      var context = this,
        args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function () {
        callback.apply(context, args);
      }, ms || 0);
    };
  }

  document.querySelectorAll("form input").forEach(function (input) {
    input.addEventListener("keydown", function (e) {
      if (e.keyCode == 13) {
        e.preventDefault();
        return false;
      }
    });
  });

  function search(searchbox) {
    var value = searchbox.value.toLowerCase();
    document.querySelectorAll("#gamesRow div.game").forEach(function (el) {
      var anchor = el.querySelector("a");
      var title = (anchor ? anchor.title : "").toLowerCase();
      el.style.display = title.indexOf(value) > -1 ? "" : "none";
    });
    updateGameCount();
    localStorage.removeItem("filterType");
    localStorage.removeItem("filterValue");
  }

  var gameSearch = document.getElementById("gameSearch");
  if (gameSearch) {
    gameSearch.addEventListener("search", function () {
      search(this);
    });

    gameSearch.addEventListener(
      "keyup",
      delay(function () {
        search(this);
      }, 400)
    );

    if (gameSearch.value) {
      search(gameSearch);
    }
  }
  checkFilter();

  var randomSelect = document.getElementById("randomSelect");
  if (randomSelect) {
    randomSelect.addEventListener("click", function (e) {
      e.preventDefault();
      var games = Array.from(document.querySelectorAll(".game")).filter(function (el) {
        return el.style.display !== "none";
      });
      if (games.length) {
        var random = Math.floor(Math.random() * games.length);
        games[random].querySelector("a").click();
      }
    });
  }
});
