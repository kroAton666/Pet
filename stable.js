// Назва плагіна: AniTube.in.ua (Local Backend Edition with Timeline & Progress)
// Версія: 1.3.0
// Опис: Онлайн-перегляд аніме з відображенням смужки перегляду та збереженням прогресу відтворення

(function () {
    'use strict';

    var BACKEND_HOST = 'http://192.168.0.6:3000';

    // Очищення назви для пошуку
    function cleanTitle(title) {
        if (!title) return '';
        return title
            .replace(/[\s.,:;’'`!?]+/g, ' ')
            .replace(/[\(\)\[\]]+/g, ' ')
            .replace(/(сезон|season|\bтв-\d+\b)/gi, '')
            .trim();
    }

    // Оновлений шаблон картки з вбудованим контейнером для смужки прогресу (таймлайну)
    Lampa.Template.add('anitube_mod', `
        <div class="online selector" style="margin-right: 50px;">
            <div class="online__body" style="width: 100%;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div class="online__title" style="padding-left: 1.5em; font-size: 1.2em;">{title}</div>
                    <div class="online__quality" style="padding-left: 1.5em; padding-right: 1.5em; font-size: 1.1em; font-weight: bold; color: #e49a1d;">{quality}</div>
                </div>
                <div class="online__timeline" style="margin: 0.6em 1.5em 0.2em 1.5em; height: 4px; background: rgba(255,255,255,0.1); border-radius: 2px; overflow: hidden; display: none;">
                    <div class="online__progress" style="height: 100%; background: #e49a1d; width: 0%;"></div>
                </div>
            </div>
        </div>
    `);

    // Створення компонента для виведення контенту
    Lampa.Component.add('anitube_component', function(object) {
        var _this = this;
        var network = new Lampa.Reguest();
        var scroll = new Lampa.Scroll({ mask: true, over: true });
        var files = new Lampa.Explorer(object);
        var filter = new Lampa.Filter(object);
        var last;
        var started = false;

        var voiceGroups = {};
        var voiceKeys = [];
        var currentVoice = '';

        this.create = function () {
            // Налаштування фільтра перекладів
            filter.onSelect = function(type, a, b) {
                if (type === 'filter') {
                    if (a.stype === 'voice') {
                        currentVoice = voiceKeys[b.index];
                        _this.renderEpisodes(currentVoice);
                        _this.updateFilter();
                        setTimeout(Lampa.Select.close, 10);
                    }
                }
            };

            filter.onBack = function() {
                _this.setFocus();
            };

            // Додаємо інтерфейс фільтрації та список до провідника Lampa
            files.appendFiles(scroll.render());
            files.appendHead(filter.render());
            scroll.minus(files.render().find('.explorer__files-head'));

            return this.render();
        };

        this.start = function () {
            started = true;
            if (voiceKeys.length > 0) {
                // Якщо плейлист вже завантажений, просто перерендеримо його, щоб оновити прогрес-бари та галочки переглядів після виходу з плеєра
                this.renderEpisodes(currentVoice);
            } else {
                this.loading(true);
                this.loadPlaylist();
            }
        };

        // Завантаження структури серій з бекенду
        this.loadPlaylist = function() {
            var url = BACKEND_HOST + '/api/lamp/play-list?id=' + encodeURIComponent(object.item.id) + '&pageUrl=' + encodeURIComponent(object.item.url);

            $.ajax({
                url: url,
                type: 'GET',
                dataType: 'json',
                success: (data) => {
                    this.loading(false);
                    if (data && data.success && data.translations) {
                        try {
                            this.parseData(data.translations);
                        } catch(e) {
                            this.empty("Помилка обробки даних: " + e.message);
                        }
                    } else {
                        this.empty("Невірний формат відповіді від бекенду.");
                    }
                },
                error: () => {
                    this.loading(false);
                    this.empty("Помилка завантаження плейлиста.");
                }
            });
        };

        // Обробка отриманих від бекенду озвучень
        this.parseData = function(translations) {
            voiceGroups = {};

            translations.forEach(function(trans) {
                var transName = trans.name || 'Озвучення';

                if (trans.studios) {
                    trans.studios.forEach(function(studio) {
                        var studioName = studio.name || 'Стандартна студія';

                        if (studio.players) {
                            studio.players.forEach(function(player, playerIndex) {
                                var playerName = player.name;
                                var suffix = '';
                                if (!playerName) {
                                    if (studio.players.length > 1) {
                                        suffix = ' (Варіант ' + (playerIndex + 1) + ')';
                                    }
                                } else {
                                    suffix = ' (' + playerName + ')';
                                }

                                var voiceKey = transName + ' - ' + studioName + suffix;

                                if (player.episodes && player.episodes.length > 0) {
                                    voiceGroups[voiceKey] = player.episodes.map(function(ep) {
                                        return {
                                            name: ep.title,
                                            file: ep.file
                                        };
                                    });
                                }
                            });
                        }
                    });
                }
            });

            voiceKeys = Object.keys(voiceGroups);
            if (voiceKeys.length === 0) {
                this.empty("Не знайдено серій.");
                return;
            }

            currentVoice = voiceKeys[0];

            this.updateFilter();
            this.renderEpisodes(currentVoice);
        };

        // Оновлення значень у доковому меню фільтра Lampa
        this.updateFilter = function() {
            var select = [];
            var subitems = voiceKeys.map(function(voice, idx) {
                return {
                    title: voice,
                    selected: voice === currentVoice,
                    index: idx
                };
            });

            select.push({
                title: "Озвучення",
                subtitle: currentVoice,
                items: subitems,
                stype: 'voice'
            });

            filter.set('filter', select);
            filter.chosen('filter', ["Озвучення: " + currentVoice]);
        };

        // Відображення серій для обраного перекладу
        this.renderEpisodes = function(voiceKey) {
            scroll.clear();

            var episodes = voiceGroups[voiceKey];
            var viewed = Lampa.Storage.cache('online_view', 5000, []);

            episodes.forEach(function(ep) {
                // Генерація унікального хешу для відстеження прогресу та статусу перегляду
                var hash = Lampa.Utils.hash((object.movie.title || object.movie.name) + voiceKey + ep.name);
                var isWatched = viewed.indexOf(hash) !== -1;

                // Запит збереженого таймлайну (прогресу перегляду) з бази Lampa
                var timeline = Lampa.Timeline.view(hash);

                var item = Lampa.Template.get('anitube_mod', {
                    title: ep.name,
                    quality: isWatched ? '✔ Переглянуто' : 'HD'
                });

                // Відображення смужки прогресу, якщо серія була запущена раніше
                if (timeline && timeline.percent > 0) {
                    item.find('.online__timeline').show();
                    item.find('.online__progress').css('width', timeline.percent + '%');
                }

                item.on('hover:enter', function() {
                    _this.loading(true);
                    _this.getStreamUrl(ep.file, function(streamUrl) {
                        _this.loading(false);
                        if (streamUrl) {

                            // Створення повного плейлиста для плеєра Lampa з динамічним резолвером посилань
                            var playlist = episodes.map(function(e) {
                                var epHash = Lampa.Utils.hash((object.movie.title || object.movie.name) + voiceKey + e.name);
                                var epTimeline = Lampa.Timeline.view(epHash);

                                var playItem = {
                                    title: (object.movie.title || object.movie.name) + ' - ' + voiceKey + ' - ' + e.name,
                                    timeline: epTimeline, // Передаємо об'єкт таймлайну плеєру для автозбереження прогресу та відновлення місця зупинки
                                    url: function(cb) {
                                        _this.getStreamUrl(e.file, function(resolvedUrl) {
                                            if (resolvedUrl) {
                                                playItem.url = resolvedUrl;
                                                cb({
                                                    url: resolvedUrl,
                                                    title: playItem.title
                                                });
                                            } else {
                                                cb({ url: '' });
                                                Lampa.Noty.show("Не вдалося отримати посилання для наступної серії.");
                                            }
                                        });
                                    },
                                    callback: function() {
                                        _this.markAsWatched(e, voiceKey, item);
                                    }
                                };
                                return playItem;
                            });

                            var epIndex = episodes.indexOf(ep);
                            var firstPlayItem = playlist[epIndex];

                            firstPlayItem.url = streamUrl;

                            Lampa.Player.play(firstPlayItem);
                            Lampa.Player.playlist(playlist);
                        } else {
                            Lampa.Noty.show("Не вдалося отримати відеопотік.");
                        }
                    });
                });

                _this.append(item);
            });

            this.setFocus();
        };

        // Позначити серію як переглянуту
        this.markAsWatched = function(ep, voiceKey, itemHtml) {
            var hash = Lampa.Utils.hash((object.movie.title || object.movie.name) + voiceKey + ep.name);
            var viewed = Lampa.Storage.cache('online_view', 5000, []);
            if (viewed.indexOf(hash) === -1) {
                viewed.push(hash);
                Lampa.Storage.set('online_view', viewed);
                if (itemHtml) {
                    itemHtml.find('.online__quality').text('✔ Переглянуто');
                }
            }
        };

        // Запит до локального бекенду для отримання посилання на відео
        this.getStreamUrl = function(iframeUrl, callback) {
            if (!iframeUrl) {
                callback(null);
                return;
            }

            if (iframeUrl.indexOf('.m3u8') !== -1 || iframeUrl.indexOf('.mp4') !== -1) {
                callback(iframeUrl);
                return;
            }

            $.ajax({
                url: BACKEND_HOST + '/api/lamp/extract-video?url=' + encodeURIComponent(iframeUrl),
                type: 'GET',
                success: function(response) {
                    var streamUrl = '';
                    var data = response;

                    if (typeof data === 'string') {
                        var trimmed = data.trim();
                        if (trimmed.indexOf('{') === 0) {
                            try {
                                data = JSON.parse(trimmed);
                            } catch (e) {}
                        } else {
                            streamUrl = trimmed;
                        }
                    }

                    if (typeof data === 'object' && data !== null) {
                        streamUrl = data.videoUrl || data.url || data.file || data.stream || (data.data && data.data.url);
                    }

                    if (streamUrl && (streamUrl.indexOf('http') === 0 || streamUrl.indexOf('//') === 0)) {
                        callback(streamUrl);
                    } else {
                        callback(null);
                    }
                },
                error: function() {
                    callback(null);
                }
            });
        };

        // Керування фокусом за допомогою стандартного контролера Lampa
        this.setFocus = function() {
            last = scroll.render().find('.selector').eq(0)[0];
            Lampa.Controller.add('content', {
                toggle: () => {
                    Lampa.Controller.collectionSet(scroll.render(), files.render());
                    Lampa.Controller.collectionFocus(last || false, scroll.render());
                },
                up: () => {
                    if (Navigator.canmove('up')) Navigator.move('up');
                    else Lampa.Controller.toggle('head');
                },
                down: () => {
                    Navigator.move('down');
                },
                right: () => {
                    if (Navigator.canmove('right')) Navigator.move('right');
                    else filter.show('Озвучення', 'filter');
                },
                left: () => {
                    if (Navigator.canmove('left')) Navigator.move('left');
                    else Lampa.Controller.toggle('menu');
                },
                back: () => {
                    Lampa.Activity.backward();
                }
            });
            Lampa.Controller.toggle('content');
        };

        this.empty = function(msg) {
            scroll.clear();
            var empty = Lampa.Template.get('list_empty');
            if (msg) empty.find('.empty__descr').text(msg);
            scroll.append(empty);
            this.loading(false);
        };

        this.loading = function(status) {
            if (status) this.activity.loader(true);
            else this.activity.loader(false);
        };

        this.append = function(item) {
            item.on('hover:focus', (e) => {
                last = e.target;
                scroll.update($(e.target), true);
            });
            scroll.append(item);
        };

        this.render = function() {
            return files.render();
        };

        this.destroy = function () {
            network.clear();
            files.destroy();
            scroll.destroy();
        };
    });

    // Відкриття компонента після пошуку
    function openComponent(item, movie) {
        Lampa.Activity.push({
            url: '',
            title: 'AniTube',
            component: 'anitube_component',
            item: item,
            movie: movie
        });
    }

    // Відображення результатів пошуку
    function showSearchResults(results, movie) {
        if (results.length === 1) {
            openComponent(results[0], movie);
            return;
        }

        var controller = Lampa.Controller.enabled().name;

        Lampa.Select.show({
            title: "Пошук на AniTube",
            items: results.map(function(item, index) {
                return {
                    title: item.title + (item.year ? ' (' + item.year + ')' : ''),
                    selected: index === 0,
                    item: item
                };
            }),
            onSelect: function(selected) {
                Lampa.Controller.toggle(controller);
                openComponent(selected.item, movie);
            },
            onBack: function() {
                Lampa.Controller.toggle(controller);
            }
        });
    }

    // Запит пошуку до локального бекенду
    function performSearch(query, callback, error) {
        $.ajax({
            url: BACKEND_HOST + '/api/lamp/get-list?searchQuery=' + encodeURIComponent(query),
            type: 'GET',
            dataType: 'json',
            success: function(data) {
                if (data && data.success && data.results) {
                    var mappedResults = data.results.map(function(item) {
                        return {
                            id: item.id,
                            title: item.title,
                            url: item.url,
                            poster: item.poster || '',
                            desc: '',
                            year: ''
                        };
                    });
                    callback(mappedResults);
                } else {
                    error("Невірний формат відповіді від бекенду.");
                }
            },
            error: function(xhr, status, err) {
                error("Помилка запиту до локального бекенду.");
            }
        });
    }

    function startSearch(movie) {
        Lampa.Loading.start();

        var query = cleanTitle(movie.title || movie.name);

        performSearch(query, function(results) {
            Lampa.Loading.stop();
            if (results.length === 0) {
                var origQuery = cleanTitle(movie.original_title || movie.original_name);
                if (origQuery && origQuery !== query) {
                    Lampa.Loading.start();
                    performSearch(origQuery, function(origResults) {
                        Lampa.Loading.stop();
                        if (origResults.length === 0) {
                            Lampa.Noty.show("Нічого не знайдено на AniTube.");
                        } else {
                            showSearchResults(origResults, movie);
                        }
                    }, function(err) {
                        Lampa.Loading.stop();
                        Lampa.Noty.show("Помилка пошуку: " + err);
                    });
                } else {
                    Lampa.Noty.show("Нічого не знайдено на AniTube.");
                }
            } else {
                showSearchResults(results, movie);
            }
        }, function(err) {
            Lampa.Loading.stop();
            Lampa.Noty.show("Помилка пошуку: " + err);
        });
    }

    // Додавання плагіна та кнопки на сторінку опису
    function initPlugin() {
        if (window.anitube_plugin_initialized) return;
        window.anitube_plugin_initialized = true;

        var manifest = {
            type: 'video',
            version: '1.3.0',
            name: 'AniTube.in.ua',
            description: 'Український онлайн-перегляд аніме зі збереженням прогресу відтворення',
            component: 'anitube_view'
        };
        Lampa.Manifest.plugins = manifest;

        Lampa.Listener.follow('full', function (e) {
            if (e.type === 'complite') {
                var movie = e.data.movie;

                var button = $('<div class="full-start__button selector view--online anitube-button" style="background: #e49a1d; color: #000; font-weight: bold; border-radius: 4px;">' +
                    '  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align: middle; margin-right: 6px; display: inline-block;">' +
                    '    <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM10 16.5V7.5L16 12L10 16.5Z" fill="currentColor"/>' +
                    '  </svg>' +
                    '  <span>AniTube</span>' +
                    '</div>');

                button.on('hover:enter', function () {
                    startSearch(movie);
                });

                var render = e.render;
                if (!render && e.object && e.object.activity && typeof e.object.activity.render === 'function') {
                    render = e.object.activity.render();
                }

                if (render) {
                    var torrentBtn = render.find('.view--torrent');
                    if (torrentBtn.length) {
                        torrentBtn.after(button);
                    } else {
                        var buttonsContainer = render.find('.full-start__buttons');
                        if (buttonsContainer.length) {
                            buttonsContainer.append(button);
                        } else {
                            var anyButton = render.find('.full-start__button').last();
                            if (anyButton.length) {
                                anyButton.after(button);
                            }
                        }
                    }
                    if (e.object && e.object.navigation) {
                        e.object.navigation();
                    }
                }
            }
        });
    }

    if (window.appready) {
        initPlugin();
    } else {
        Lampa.Listener.follow('app', function (e) {
            if (e.type === 'ready') initPlugin();
        });
    }
})();