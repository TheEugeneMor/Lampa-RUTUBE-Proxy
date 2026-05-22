(function () {
    'use strict';

    if (window.lapma_rutube_plugin) return;

    function boot() {
        if (!window.Lampa || !window.$) {
            setTimeout(boot, 300);
            return;
        }

        window.lapma_rutube_plugin = true;

        var pluginName = 'Rutube';
        var pluginAuthor = 'Eugene Pchelnikov';
        var pluginContact = 'https://t.me/eugenemor';
        var componentName = 'lapma_rutube';
        var playerComponentName = 'lapma_rutube_player';
        function pluginBaseUrl() {
            var current = document.currentScript && document.currentScript.src ? document.currentScript.src : '';

            if (!current) {
                var scripts = document.getElementsByTagName('script');

                for (var i = scripts.length - 1; i >= 0; i--) {
                    var src = scripts[i].src || '';

                    if (/\/rt\.js(?:[?#].*)?$/.test(src)) {
                        current = src;
                        break;
                    }
                }
            }

            return current ? current.replace(/[^\/]+(?:[?#].*)?$/, '') : './';
        }

        var baseUrl = pluginBaseUrl();
        var apiUrl = baseUrl + 'proxy.php';
        var streamUrl = baseUrl + 'stream.php';

        Lampa.Lang.add({
            lapma_rutube_watch: {
                ru: 'Смотреть на RUTUBE',
                en: 'Watch on RUTUBE'
            },
            lapma_rutube_results: {
                ru: 'RUTUBE',
                en: 'RUTUBE'
            },
            lapma_rutube_empty: {
                ru: 'На RUTUBE ничего не найдено',
                en: 'Nothing found on RUTUBE'
            },
            lapma_rutube_error: {
                ru: 'Не удалось получить данные RUTUBE',
                en: 'Failed to load RUTUBE data'
            }
        });

        function translate(key) {
            return Lampa.Lang && Lampa.Lang.translate ? Lampa.Lang.translate(key) : key;
        }

        function escapeHtml(value) {
            return String(value || '').replace(/[&<>"']/g, function (char) {
                return {
                    '&': '&amp;',
                    '<': '&lt;',
                    '>': '&gt;',
                    '"': '&quot;',
                    "'": '&#39;'
                }[char];
            });
        }

        function secondsToTime(seconds) {
            seconds = parseInt(seconds || 0, 10);
            if (!seconds) return '';

            var h = Math.floor(seconds / 3600);
            var m = Math.floor((seconds % 3600) / 60);
            var s = seconds % 60;
            var mm = m < 10 ? '0' + m : String(m);
            var ss = s < 10 ? '0' + s : String(s);

            if (h) return h + ':' + mm + ':' + ss;
            return m + ':' + ss;
        }

        function searchQueryFromMovie(movie) {
            if (!movie) return '';

            var parts = [];
            var title = movie.title || movie.name || movie.original_title || movie.original_name || '';
            var original = movie.original_title || movie.original_name || '';
            var year = '';

            if (movie.release_date) year = String(movie.release_date).slice(0, 4);
            if (!year && movie.first_air_date) year = String(movie.first_air_date).slice(0, 4);

            if (title) parts.push(title);
            if (original && original !== title) parts.push(original);
            if (year) parts.push(year);

            return parts.join(' ');
        }

        function titleFromMovie(movie) {
            if (!movie) return '';

            var title = movie.title || movie.name || movie.original_title || movie.original_name || '';
            var original = movie.original_title || movie.original_name || '';

            if (original && original !== title) return title + ' ' + original;

            return title;
        }

        function yearFromMovie(movie) {
            if (!movie) return '';
            if (movie.release_date) return String(movie.release_date).slice(0, 4);
            if (movie.first_air_date) return String(movie.first_air_date).slice(0, 4);
            return '';
        }

        function seriesSeasons(movie) {
            var result = [];

            if (!movie) return result;

            if (movie.seasons && movie.seasons.length) {
                movie.seasons.forEach(function (season) {
                    var number = parseInt(season.season_number, 10);

                    if (number > 0) {
                        result.push({
                            number: number,
                            episodes: parseInt(season.episode_count || 0, 10) || 0
                        });
                    }
                });
            }

            if (!result.length && movie.number_of_seasons) {
                for (var i = 1; i <= Math.min(parseInt(movie.number_of_seasons, 10) || 0, 50); i++) {
                    result.push({
                        number: i,
                        episodes: 0
                    });
                }
            }

            result.sort(function (a, b) {
                return a.number - b.number;
            });

            return result;
        }

        function storageGet(key, fallback) {
            try {
                if (Lampa.Storage && Lampa.Storage.get) return Lampa.Storage.get(key, fallback);
            } catch (ignore) {}

            return fallback;
        }

        function storageSet(key, value) {
            try {
                if (Lampa.Storage && Lampa.Storage.set) Lampa.Storage.set(key, value);
            } catch (ignore) {}
        }

        function watchedStore() {
            var store = storageGet('lapma_rutube_watched', {});
            return store && typeof store === 'object' ? store : {};
        }

        function watchedSave(store) {
            storageSet('lapma_rutube_watched', store || {});
        }

        function movieKey(movie) {
            if (!movie) return 'unknown';
            if (movie.id) return 'tmdb:' + movie.id;
            return 'title:' + (movie.title || movie.name || movie.original_title || movie.original_name || 'unknown');
        }

        function watchedEpisodeKey(movie, season, episode) {
            return movieKey(movie) + ':s' + season + ':e' + episode;
        }

        function watchedVideoKey(id) {
            return 'rutube:' + id;
        }

        function extractNumber(patterns, text) {
            text = String(text || '').toLowerCase();

            for (var i = 0; i < patterns.length; i++) {
                var match = text.match(patterns[i]);

                if (match && match[1]) return parseInt(match[1], 10) || 0;
            }

            return 0;
        }

        function extractEpisodeInfo(item) {
            var title = String(item.title || '').toLowerCase();
            var text = [
                title,
                item.description || ''
            ].join(' ').toLowerCase();

            return {
                season: extractNumber([
                    /(?:^|[\s(])s0?(\d{1,2})e0?\d{1,3}(?:\D|$)/i,
                    /(?:^|[\s(])0?(\d{1,2})x0?\d{1,3}(?:\D|$)/i,
                    /(\d{1,2})\s*(?:сезон|season)/i,
                    /(?:сезон|season)\s*(\d{1,2})/i
                ], text),
                episode: extractNumber([
                    /(?:^|[\s(])s0?\d{1,2}e0?(\d{1,3})(?:\D|$)/i,
                    /(?:^|[\s(])0?\d{1,2}x0?(\d{1,3})(?:\D|$)/i,
                    /(\d{1,3})\s*(?:-?\s*я)?\s*(?:серия|серии|сер\.?|эпизод|episode|ep\.?)(?:\D|$)/i,
                    /(\d{1,3})\s*(?:серия|серии|эпизод|episode|ep\.?)(?:\D|$)/i,
                    /(?:серия|сер\.?|эпизод|episode|ep\.?)\s*(\d{1,3})(?:\D|$)/i
                ], text),
                title: title
            };
        }

        function request(query, page, success, failure) {
            var url = apiUrl + '?q=' + encodeURIComponent(query) + '&page=' + encodeURIComponent(page || 1);

            $.ajax({
                url: url,
                dataType: 'json',
                timeout: 20000,
                success: function (data) {
                    if (data && data.ok) success(data);
                    else failure(data && data.error ? data.error : 'RUTUBE error');
                },
                error: function () {
                    failure('Network error');
                }
            });
        }

        function playEmbed(item, onWatch) {
            Lampa.Activity.push({
                component: playerComponentName,
                title: item.title || 'RUTUBE',
                item: item,
                onWatch: onWatch
            });
        }

        function externalPlayerMode() {
            try {
                if (Lampa.Platform && Lampa.Platform.is) {
                    if (Lampa.Platform.is('android')) return 'android';
                    if (Lampa.Platform.is('webos')) return 'webos';
                }
            } catch (ignore) {}

            return '';
        }

        function openDirectExternal(url, item) {
            var title = item && item.title ? item.title : 'RUTUBE';
            var data = {
                url: url,
                title: title,
                position: -1
            };

            try {
                if (typeof AndroidJS !== 'undefined' && AndroidJS.openPlayer) {
                    AndroidJS.openPlayer(url, JSON.stringify(data));
                    return true;
                }
            } catch (ignoreAndroid) {}

            try {
                if (window.webOS && webOS.service && webOS.service.request) {
                    webOS.service.request('luna://com.webos.applicationManager', {
                        method: 'launch',
                        parameters: {
                            id: 'com.webos.app.photovideo',
                            params: {
                                payload: [{
                                    fullPath: url,
                                    fileName: title,
                                    mediaType: 'VIDEO',
                                    lastPlayPosition: -1
                                }]
                            }
                        }
                    });
                    return true;
                }
            } catch (ignoreWebos) {}

            return false;
        }

        function play(item, onWatch) {
            if (onWatch) onWatch(item);

            if (!item || !item.id || !Lampa.Player || !Lampa.Player.play) {
                playEmbed(item, onWatch);
                return;
            }

            if (Lampa.Noty) Lampa.Noty.show('Запускаю встроенный плеер...');

            $.ajax({
                url: streamUrl + '?id=' + encodeURIComponent(item.id),
                dataType: 'json',
                timeout: 20000,
                success: function (data) {
                    if (data && data.ok && data.url) {
                        Lampa.Player.play({
                            url: data.url,
                            title: item.title || 'RUTUBE',
                            quality: {
                                auto: data.url
                            },
                            hls_type: 'hlsjs',
                            timeline: false
                        });
                    } else {
                        if (Lampa.Noty) Lampa.Noty.show('Поток недоступен, открываю плеер RUTUBE');
                        playEmbed(item, onWatch);
                    }
                },
                error: function () {
                    if (Lampa.Noty) Lampa.Noty.show('Поток недоступен, открываю плеер RUTUBE');
                    playEmbed(item, onWatch);
                }
            });
        }

        function moveNavigator(direction) {
            try {
                if (window.Navigator && Navigator.move) Navigator.move(direction);
            } catch (ignore) {}
        }

        function renderItem(item, isWatched, onSelect) {
            var duration = secondsToTime(item.duration);
            var meta = [];

            if (duration) meta.push(duration);
            if (item.author) meta.push(item.author);
            if (item.views) meta.push(String(item.views).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' views');
            if (isWatched) meta.unshift('Просмотрено');

            var image = item.thumbnail
                ? '<div class="lapma-rutube-item__poster" style="background-image:url(' + escapeHtml(item.thumbnail) + ')"></div>'
                : '<div class="lapma-rutube-item__poster lapma-rutube-item__poster--empty"></div>';

            var node = $(
                '<div class="lapma-rutube-item selector' + (isWatched ? ' lapma-rutube-item--watched' : '') + '">' +
                    image +
                    '<div class="lapma-rutube-item__body">' +
                        '<div class="lapma-rutube-item__title">' + (isWatched ? '<span class="lapma-rutube-watchmark">✓</span>' : '') + escapeHtml(item.title) + '</div>' +
                        '<div class="lapma-rutube-item__meta">' + escapeHtml(meta.join(' • ')) + '</div>' +
                        '<div class="lapma-rutube-item__description">' + escapeHtml(item.description) + '</div>' +
                    '</div>' +
                    '<div class="lapma-rutube-item__play">▶</div>' +
                '</div>'
            );

            node.on('hover:focus', function () {
                try {
                    if (this.scrollIntoView) this.scrollIntoView({ block: 'nearest' });
                } catch (ignore) {}
            }).on('hover:enter click', function () {
                play(item, function (selected) {
                    if (onSelect) onSelect(selected, node);
                });
            });

            return node;
        }

        function addStyles() {
            if (document.getElementById('lapma-rutube-style')) return;

            $('head').append(
                '<style id="lapma-rutube-style">' +
                '.lapma-rutube{padding:1.5em 2em 3em;max-width:1100px;margin:0 auto;height:100vh;overflow-y:auto;box-sizing:border-box;scroll-behavior:smooth;}' +
                '.lapma-rutube__title{font-size:1.45em;font-weight:600;margin-bottom:1em;}' +
                '.lapma-rutube__controls{display:flex;flex-direction:column;gap:.7em;margin-bottom:1em;}' +
                '.lapma-rutube__control-row{display:flex;gap:.45em;align-items:center;overflow-x:auto;padding-bottom:.2em;}' +
                '.lapma-rutube__control-label{font-size:.82em;opacity:.64;min-width:5.8em;flex:0 0 auto;}' +
                '.lapma-rutube-searchbar{display:none;gap:.45em;align-items:center;margin-bottom:.8em;}' +
                '.lapma-rutube-searchbar--open{display:flex;}' +
                '.lapma-rutube-searchbar__input{flex:1;min-height:2.45em;padding:.5em .7em;border-radius:.32em;background:rgba(255,255,255,.12);box-sizing:border-box;}' +
                '.lapma-rutube-searchbar__input.focus{background:rgba(255,255,255,.22);}' +
                '.lapma-rutube-searchbar__input:empty:before{content:"Введите запрос";opacity:.5;}' +
                '.lapma-rutube-searchbar__button{flex:0 0 auto;padding:.55em .75em;border-radius:.32em;background:rgba(255,255,255,.11);}' +
                '.lapma-rutube-searchbar__button.focus,.lapma-rutube-searchbar__button:hover{background:rgba(255,255,255,.24);}' +
                '.lapma-rutube-chip{flex:0 0 auto;padding:.48em .72em;border-radius:.32em;background:rgba(255,255,255,.09);font-size:.9em;}' +
                '.lapma-rutube-chip.focus,.lapma-rutube-chip:hover{background:rgba(255,255,255,.23);}' +
                '.lapma-rutube-chip--watched{opacity:.75;}' +
                '.lapma-rutube-chip--active{background:#e53935;color:#fff;}' +
                '.lapma-rutube-chip--active.focus,.lapma-rutube-chip--active:hover{background:#f0524e;}' +
                '.lapma-rutube__list{display:flex;flex-direction:column;gap:.75em;}' +
                '.lapma-rutube-item{display:flex;gap:1em;align-items:center;padding:.75em;border-radius:.35em;background:rgba(255,255,255,.07);}' +
                '.lapma-rutube-item.focus,.lapma-rutube-item:hover{background:rgba(255,255,255,.16);}' +
                '.lapma-rutube-item--watched{opacity:.72;}' +
                '.lapma-rutube-item__poster{width:12em;aspect-ratio:16/9;background-size:cover;background-position:center;border-radius:.25em;background-color:rgba(255,255,255,.12);flex:0 0 auto;}' +
                '.lapma-rutube-item__poster--empty:before{content:"RUTUBE";display:flex;align-items:center;justify-content:center;height:100%;opacity:.55;font-weight:700;}' +
                '.lapma-rutube-item__body{min-width:0;flex:1;}' +
                '.lapma-rutube-item__title{font-size:1.12em;font-weight:600;line-height:1.25;margin-bottom:.35em;}' +
                '.lapma-rutube-item__meta{font-size:.82em;opacity:.72;margin-bottom:.45em;}' +
                '.lapma-rutube-item__description{font-size:.86em;opacity:.78;line-height:1.35;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}' +
                '.lapma-rutube-item__play{font-size:1.35em;opacity:.8;padding:0 .4em;}' +
                '.lapma-rutube-watchmark{display:inline-flex;align-items:center;justify-content:center;width:1.25em;height:1.25em;margin-right:.45em;border-radius:50%;background:#35a853;color:#fff;font-size:.78em;}' +
                '.lapma-rutube-empty{padding:2em;opacity:.8;text-align:center;}' +
                '.lapma-rutube-player{position:fixed;inset:0;background:#000;z-index:50;display:flex;flex-direction:column;}' +
                '.lapma-rutube-player__frame{border:0;width:100%;height:100%;flex:1;background:#000;pointer-events:auto;}' +
                '.lapma-rutube-player__bar{display:flex;align-items:center;gap:1em;padding:.75em 1em;background:rgba(0,0,0,.92);}' +
                '.lapma-rutube-player__title{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}' +
                '.lapma-rutube-player__close{padding:.55em .9em;border-radius:.3em;background:rgba(255,255,255,.14);}' +
                '.lapma-rutube-player__close.focus,.lapma-rutube-player__close:hover{background:rgba(255,255,255,.26);}' +
                '.lapma-rutube-player__control{padding:.55em .9em;border-radius:.3em;background:rgba(255,255,255,.14);}' +
                '.lapma-rutube-player__control.focus,.lapma-rutube-player__control:hover{background:rgba(255,255,255,.26);}' +
                '.lapma-rutube-player__hint{font-size:.82em;opacity:.65;}' +
                '</style>'
            );
        }

        function empty(text) {
            return $('<div class="lapma-rutube-empty">' + escapeHtml(text) + '</div>');
        }

        function RutubeComponent(object) {
            var html = $('<div class="lapma-rutube"></div>');
            var title = $('<div class="lapma-rutube__title"></div>');
            var controls = $('<div class="lapma-rutube__controls"></div>');
            var searchbar = $('<div class="lapma-rutube-searchbar"></div>');
            var searchInput = $('<div class="lapma-rutube-searchbar__input selector" data-kind="search" data-value="input"></div>');
            var searchApply = $('<div class="lapma-rutube-searchbar__button selector" data-kind="search" data-value="apply">Искать</div>');
            var searchClear = $('<div class="lapma-rutube-searchbar__button selector" data-kind="search" data-value="clear">Очистить</div>');
            var searchCancel = $('<div class="lapma-rutube-searchbar__button selector" data-kind="search" data-value="cancel">Отмена</div>');
            var list = $('<div class="lapma-rutube__list"></div>');
            var movie = object.movie || {};
            var query = object.search || searchQueryFromMovie(movie);
            var manualQuery = '';
            var seasons = seriesSeasons(movie);
            var isSeries = !!(movie.name || movie.original_name || seasons.length);
            var activeSeason = 0;
            var activeEpisode = 0;
            var items = $();
            var loaded = false;
            var self = this;
            var searchOpen = false;
            var searchDraft = '';

            function baseSeriesQuery() {
                var parts = [];
                var base = titleFromMovie(movie) || query;
                var year = yearFromMovie(movie);

                if (base) parts.push(base);
                if (year) parts.push(year);

                return parts.join(' ');
            }

            function currentQuery() {
                if (manualQuery) return manualQuery;
                if (!isSeries || !activeSeason) return query;

                var parts = [baseSeriesQuery(), 'сезон ' + activeSeason];

                if (activeEpisode) parts.push('серия ' + activeEpisode);

                return parts.join(' ');
            }

            function seasonData(number) {
                for (var i = 0; i < seasons.length; i++) {
                    if (seasons[i].number === number) return seasons[i];
                }

                return null;
            }

            function episodeCount(number) {
                var season = seasonData(number);

                if (season && season.episodes) return Math.min(season.episodes, 80);

                return 40;
            }

            function isWatchedEpisode(season, episode) {
                if (!season || !episode) return false;
                return !!watchedStore()[watchedEpisodeKey(movie, season, episode)];
            }

            function isWatchedItem(item) {
                var store = watchedStore();
                var info = extractEpisodeInfo(item);

                if (item && item.id && store[watchedVideoKey(item.id)]) return true;
                if (info.season && info.episode && store[watchedEpisodeKey(movie, info.season, info.episode)]) return true;
                if (activeSeason && info.episode && store[watchedEpisodeKey(movie, activeSeason, info.episode)]) return true;

                return false;
            }

            function markWatched(item) {
                var store = watchedStore();
                var info = extractEpisodeInfo(item);

                if (item && item.id) store[watchedVideoKey(item.id)] = Date.now();

                if (activeSeason && activeEpisode) {
                    store[watchedEpisodeKey(movie, activeSeason, activeEpisode)] = Date.now();
                } else if (info.season && info.episode) {
                    store[watchedEpisodeKey(movie, info.season, info.episode)] = Date.now();
                } else if (activeSeason && info.episode) {
                    store[watchedEpisodeKey(movie, activeSeason, info.episode)] = Date.now();
                }

                watchedSave(store);
            }

            function focusNode(focusTarget) {
                if (!focusTarget) return false;
                if (focusTarget instanceof jQuery) return focusTarget;
                if (focusTarget.kind) {
                    return html.find('[data-kind="' + focusTarget.kind + '"][data-value="' + focusTarget.value + '"]').eq(0);
                }

                return focusTarget;
            }

            function activateNavigation(focusTarget) {
                items = html.find('.selector');

                if (!loaded || !items.length) return;

                Lampa.Controller.collectionSet(html);
                Lampa.Controller.collectionFocus(focusNode(focusTarget) || false, html);
            }

            function renderChip(text, active, action, kind, value, watched) {
                return $('<div class="lapma-rutube-chip selector' + (active ? ' lapma-rutube-chip--active' : '') + (watched ? ' lapma-rutube-chip--watched' : '') + '" data-kind="' + escapeHtml(kind || '') + '" data-value="' + escapeHtml(value || '') + '">' + (watched ? '✓ ' : '') + escapeHtml(text) + '</div>')
                    .on('hover:focus', function () {
                        try {
                            if (this.scrollIntoView) this.scrollIntoView({ block: 'nearest', inline: 'nearest' });
                        } catch (ignore) {}
                        scrollToFocused(this);
                    })
                    .on('hover:enter click', function () {
                        action(this);
                    });
            }

            function renderControls(focusTarget) {
                controls.empty();

                var searchRow = $('<div class="lapma-rutube__control-row"></div>');
                searchRow.append('<div class="lapma-rutube__control-label">Поиск</div>');
                searchRow.append(renderChip(manualQuery ? 'Изменить' : 'Ручной поиск', false, function () {
                    openManualSearch();
                }, 'search', 'manual'));

                if (manualQuery) {
                    searchRow.append(renderChip('Сбросить', false, function () {
                        manualQuery = '';
                        loadResults({ kind: 'search', value: 'manual' });
                    }, 'search', 'reset'));
                }

                controls.append(searchRow);

                if (!isSeries) return;

                var seasonRow = $('<div class="lapma-rutube__control-row"></div>');
                seasonRow.append('<div class="lapma-rutube__control-label">Сезоны</div>');
                seasonRow.append(renderChip('Все', !activeSeason, function () {
                    activeSeason = 0;
                    activeEpisode = 0;
                    loadResults({ kind: 'season', value: 'all' });
                }, 'season', 'all'));

                seasons.forEach(function (season) {
                    seasonRow.append(renderChip(String(season.number), activeSeason === season.number, function () {
                        activeSeason = season.number;
                        activeEpisode = 0;
                        loadResults({ kind: 'season', value: String(season.number) });
                    }, 'season', String(season.number)));
                });

                controls.append(seasonRow);

                if (activeSeason) {
                    var episodes = episodeCount(activeSeason);
                    var episodeRow = $('<div class="lapma-rutube__control-row"></div>');

                    episodeRow.append('<div class="lapma-rutube__control-label">Серии</div>');
                    episodeRow.append(renderChip('Весь сезон', !activeEpisode, function () {
                        activeEpisode = 0;
                        loadResults({ kind: 'episode', value: 'all' });
                    }, 'episode', 'all'));

                    for (var i = 1; i <= episodes; i++) {
                        (function (episode) {
                            episodeRow.append(renderChip(String(episode), activeEpisode === episode, function () {
                                activeEpisode = episode;
                                loadResults({ kind: 'episode', value: String(episode) });
                            }, 'episode', String(episode), isWatchedEpisode(activeSeason, episode)));
                        })(i);
                    }

                    controls.append(episodeRow);
                }

                if (focusTarget) activateNavigation(focusTarget);
            }

            function updateSearchbar() {
                searchbar.toggleClass('lapma-rutube-searchbar--open', searchOpen);
                searchInput.text(searchDraft);
            }

            function openManualSearch() {
                var current = manualQuery || currentQuery() || query || '';
                searchDraft = current;
                searchOpen = true;
                updateSearchbar();
                activateNavigation({ kind: 'search', value: 'input' });
            }

            function applyManualSearch() {
                var value = String(searchDraft || '').trim();

                if (!value) return activateNavigation({ kind: 'search', value: 'input' });

                manualQuery = value;
                activeSeason = 0;
                activeEpisode = 0;
                searchOpen = false;
                updateSearchbar();
                loadResults({ kind: 'search', value: 'manual' });
            }

            function closeManualSearch() {
                searchOpen = false;
                updateSearchbar();
                activateNavigation({ kind: 'search', value: 'manual' });
            }

            function editSearchDraft(event) {
                if (!searchOpen || !searchInput.hasClass('focus')) return false;

                var key = event && event.key ? event.key : '';
                var code = event ? event.keyCode || event.which || 0 : 0;

                if (key === 'Enter' || code === 13) {
                    applyManualSearch();
                    return true;
                }

                if (key === 'Escape' || code === 27 || code === 10009 || code === 461) {
                    closeManualSearch();
                    return true;
                }

                if (key === 'Backspace' || code === 8) {
                    searchDraft = searchDraft.slice(0, -1);
                    updateSearchbar();
                    return true;
                }

                if (key && key.length === 1) {
                    searchDraft += key;
                    updateSearchbar();
                    return true;
                }

                if (code >= 48 && code <= 57) {
                    searchDraft += String(code - 48);
                    updateSearchbar();
                    return true;
                }

                return false;
            }

            function onSearchKeydown(event) {
                if (!editSearchDraft(event)) return;

                if (event.preventDefault) event.preventDefault();
                if (event.stopPropagation) event.stopPropagation();

                return false;
            }

            function loadResults(focusTarget) {
                var nextQuery = currentQuery();

                title.text(nextQuery || 'RUTUBE');
                renderControls();
                list.empty();

                if (!nextQuery) {
                    list.append(empty(translate('lapma_rutube_empty')));
                    loaded = true;
                    activateNavigation(focusTarget);
                    return;
                }

                self.activity.loader(true);

                request(nextQuery, 1, function (data) {
                    list.empty();

                    if (!data.results || !data.results.length) {
                        list.append(empty(translate('lapma_rutube_empty')));
                    } else {
                        sortResults(data.results).forEach(function (item) {
                            list.append(renderItem(item, isWatchedItem(item), function (selected, node) {
                                markWatched(selected);
                                node.addClass('lapma-rutube-item--watched');
                                if (!node.find('.lapma-rutube-watchmark').length) {
                                    node.find('.lapma-rutube-item__title').prepend('<span class="lapma-rutube-watchmark">✓</span>');
                                }
                                renderControls(activeEpisode ? { kind: 'episode', value: String(activeEpisode) } : activeSeason ? { kind: 'season', value: String(activeSeason) } : false);
                            }));
                        });
                    }

                    loaded = true;
                    self.activity.loader(false);
                    self.activity.toggle();
                    activateNavigation(focusTarget);
                }, function () {
                    list.empty().append(empty(translate('lapma_rutube_error')));
                    loaded = true;
                    self.activity.loader(false);
                    self.activity.toggle();
                    activateNavigation(focusTarget);
                });
            }

            function sortResults(results) {
                if (!isSeries || !activeSeason) return results;

                function fallbackEpisode(info) {
                    var maxEpisode = episodeCount(activeSeason);
                    var numbers = info.title.match(/\d{1,4}/g) || [];

                    for (var i = 0; i < numbers.length; i++) {
                        var number = parseInt(numbers[i], 10) || 0;

                        if (number > 0 && number <= maxEpisode && number !== activeSeason) {
                            return number;
                        }
                    }

                    return 0;
                }

                return results.slice().sort(function (a, b) {
                    var ai = extractEpisodeInfo(a);
                    var bi = extractEpisodeInfo(b);
                    var aSeasonPenalty = ai.season && ai.season !== activeSeason ? 1 : 0;
                    var bSeasonPenalty = bi.season && bi.season !== activeSeason ? 1 : 0;
                    var aEpisodePenalty = activeEpisode && ai.episode !== activeEpisode ? 1 : 0;
                    var bEpisodePenalty = activeEpisode && bi.episode !== activeEpisode ? 1 : 0;
                    var aEpisode = ai.episode || fallbackEpisode(ai) || 9999;
                    var bEpisode = bi.episode || fallbackEpisode(bi) || 9999;

                    if (aSeasonPenalty !== bSeasonPenalty) return aSeasonPenalty - bSeasonPenalty;
                    if (aEpisodePenalty !== bEpisodePenalty) return aEpisodePenalty - bEpisodePenalty;
                    if (aEpisode !== bEpisode) return aEpisode - bEpisode;

                    return 0;
                });
            }

            this.create = function () {
                self = this;
                addStyles();
                searchbar.append(searchInput, searchApply, searchClear, searchCancel);
                searchApply.on('hover:enter click', applyManualSearch);
                searchClear.on('hover:enter click', function () {
                    searchDraft = '';
                    updateSearchbar();
                    activateNavigation({ kind: 'search', value: 'input' });
                });
                searchCancel.on('hover:enter click', closeManualSearch);
                searchInput.on('hover:enter click', function () {
                    activateNavigation({ kind: 'search', value: 'input' });
                });
                window.addEventListener('keydown', onSearchKeydown, true);
                html.append(title);
                html.append(controls);
                html.append(searchbar);
                html.append(list);
                loadResults();
            };

            function scrollToFocused(target) {
                var container = html[0];
                target = target instanceof jQuery ? target[0] : target;

                if (!container || !target) return;

                var itemTop = target.offsetTop;
                var itemBottom = itemTop + target.offsetHeight;
                var visibleTop = container.scrollTop;
                var visibleBottom = visibleTop + container.clientHeight;
                var padding = Math.round(container.clientHeight * 0.18);

                if (itemTop < visibleTop + padding) {
                    container.scrollTop = Math.max(0, itemTop - padding);
                } else if (itemBottom > visibleBottom - padding) {
                    container.scrollTop = itemBottom - container.clientHeight + padding;
                }
            }

            this.start = function () {
                if (!loaded) return;

                Lampa.Controller.add('content', {
                    toggle: function () {
                        if (items.length) {
                            Lampa.Controller.collectionSet(html);
                            Lampa.Controller.collectionFocus(false, html);
                        }
                    },
                    up: function () {
                        moveNavigator('up');
                        scrollToFocused(html.find('.selector.focus'));
                    },
                    down: function () {
                        moveNavigator('down');
                        scrollToFocused(html.find('.selector.focus'));
                    },
                    left: function () {
                        moveNavigator('left');
                    },
                    right: function () {
                        moveNavigator('right');
                        scrollToFocused(html.find('.selector.focus'));
                    },
                    back: function () {
                        if (searchOpen) return closeManualSearch();
                        Lampa.Activity.backward();
                    },
                    keydown: function (event) {
                        if (editSearchDraft(event)) return;
                    }
                });

                Lampa.Controller.toggle('content');
            };

            this.pause = function () {};
            this.stop = function () {};
            this.destroy = function () {
                window.removeEventListener('keydown', onSearchKeydown, true);
                html.remove();
            };
            this.render = function () {
                return html;
            };
        }

        function RutubePlayerComponent(object) {
            var item = object.item || {};
            var embed = item.embed_url || ('https://rutube.ru/play/embed/' + item.id);
            var closed = false;
            var iframeSrc = embed + '?autoplay=1&muted=1&playsinline=1';

            var html = $(
                '<div class="lapma-rutube-player">' +
                    '<iframe class="lapma-rutube-player__frame selector" allow="clipboard-write; autoplay; fullscreen; encrypted-media; picture-in-picture" allowfullscreen webkitallowfullscreen mozallowfullscreen src="' + escapeHtml(iframeSrc) + '"></iframe>' +
                    '<div class="lapma-rutube-player__bar">' +
                        '<div class="lapma-rutube-player__title">' + escapeHtml(item.title || 'RUTUBE') + '</div>' +
                        '<div class="lapma-rutube-player__hint">OK - управление, Назад - закрыть</div>' +
                        '<div class="lapma-rutube-player__control selector">Управлять</div>' +
                        '<div class="lapma-rutube-player__close selector">Закрыть</div>' +
                    '</div>' +
                '</div>'
            );
            function closePlayer() {
                if (closed) return;

                closed = true;
                Lampa.Activity.backward();
            }

            function onKeydown(event) {
                var code = event.keyCode || event.which || 0;
                var key = event.key || '';

                if (
                    key === 'Escape' ||
                    key === 'Backspace' ||
                    key === 'BrowserBack' ||
                    code === 8 ||
                    code === 27 ||
                    code === 10009 ||
                    code === 461 ||
                    code === 166
                ) {
                    if (event.preventDefault) event.preventDefault();
                    if (event.stopPropagation) event.stopPropagation();

                    closePlayer();

                    return false;
                }
            }

            try {
                if (object.onWatch) object.onWatch(item);
            } catch (ignoreWatch) {}

            var close = html.find('.lapma-rutube-player__close').on('hover:enter click', function () {
                closePlayer();
            });
            var control = html.find('.lapma-rutube-player__control').on('hover:enter click', function () {
                try {
                    frame[0].focus();
                    if (Lampa.Noty) Lampa.Noty.show('Фокус в плеере RUTUBE. Для выхода нажмите Back/Esc, затем Закрыть.');
                } catch (ignore) {}
            });
            var frame = html.find('.lapma-rutube-player__frame');

            this.create = function () {
                addStyles();
                window.addEventListener('keydown', onKeydown, true);
                window.addEventListener('keyup', onKeydown, true);
            };
            this.start = function () {
                Lampa.Controller.add('content', {
                    toggle: function () {
                        Lampa.Controller.collectionSet(html);
                        Lampa.Controller.collectionFocus(control, html);
                    },
                    left: function () {
                        moveNavigator('left');
                    },
                    right: function () {
                        moveNavigator('right');
                    },
                    up: function () {
                        moveNavigator('up');
                    },
                    down: function () {
                        moveNavigator('down');
                    },
                    back: function () {
                        closePlayer();
                    }
                });
                Lampa.Controller.toggle('content');
            };
            this.pause = function () {};
            this.stop = function () {};
            this.destroy = function () {
                window.removeEventListener('keydown', onKeydown, true);
                window.removeEventListener('keyup', onKeydown, true);
                html.remove();
            };
            this.render = function () {
                return html;
            };
        }

        function openForMovie(movie) {
            Lampa.Activity.push({
                url: '',
                title: translate('lapma_rutube_results'),
                component: componentName,
                search: searchQueryFromMovie(movie),
                movie: movie,
                page: 1,
                noinfo: true
            });
        }

        function addButton(event) {
            var render = event && event.object && event.object.activity ? event.object.activity.render() : null;
            var movie = event && event.data ? event.data.movie : null;

            if (!render || !movie || render.find('.lapma-rutube-button').length) return;

            var button = $(
                '<div class="full-start__button selector view--online lapma-rutube-button" data-subtitle="RUTUBE">' +
                    '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M8 5v14l11-7z"></path></svg>' +
                    '<span>' + translate('lapma_rutube_watch') + '</span>' +
                '</div>'
            ).on('hover:enter click', function () {
                openForMovie(movie);
            });

            var target = render.find('.view--torrent').last();
            if (target.length) target.after(button);
            else render.find('.full-start').append(button);
        }

        Lampa.Component.add(componentName, RutubeComponent);
        Lampa.Component.add(playerComponentName, RutubePlayerComponent);

        Lampa.Manifest.plugins = {
            type: 'video',
            version: '1.6.0',
            name: pluginName,
            description: 'Поиск и просмотр видео RUTUBE из карточек Lampa. Автор: ' + pluginAuthor + ' (' + pluginContact + ')',
            component: componentName,
            onContextMenu: function () {
                return {
                    name: translate('lapma_rutube_watch'),
                    description: 'RUTUBE'
                };
            },
            onContextLauch: function (object) {
                openForMovie(object);
            }
        };

        Lampa.Listener.follow('full', function (event) {
            if (event.type === 'complite') addButton(event);
        });

        try {
            var active = Lampa.Activity.active();
            if (active && active.component === 'full' && active.activity && active.card) {
                addButton({
                    object: { activity: active.activity },
                    data: { movie: active.card }
                });
            }
        } catch (ignore) {}

        console.log('Lapma RUTUBE plugin loaded from ' + baseUrl + '. Author: ' + pluginAuthor + ' ' + pluginContact);
    }

    boot();
})();
