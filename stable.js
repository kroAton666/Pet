// Назва плагіна: AniTube.in.ua (Local Backend Edition)
// Версія: 1.1.0
// Опис: Онлайн-перегляд аніме з сайту AniTube через локальний бекенд та вбудовані шаблони Lampa

(function () {
    'use strict';

    var BACKEND_HOST = 'http://192.168.0.6:3000';

    // Очищення назви для покращення точності пошуку
    function cleanTitle(title) {
        if (!title) return '';
        return title
            .replace(/[\s.,:;’'`!?]+/g, ' ')
            .replace(/[\(\)\[\]]+/g, ' ')
            .replace(/(сезон|season|\bтв-\d+\b)/gi, '')
            .trim();
    }

    // Реєстрація шаблону Lampa для відображення карток елементів (озвучень та серій)
    Lampa.Template.add('anitube_mod', `
        <div class="online selector">
            <div class="online__body">
                <div class="online__title" style="padding-left: 1.5em;">{title}</div>
                <div class="online__quality" style="padding-left: 1.5em;">{quality}</div>
            </div>
        </div>
    `);

    // Створення компонента для виведення контенту у списку
    Lampa.Component.add('anitube_component', function(object) {
        var network = new Lampa.Reguest();
        var scroll = new Lampa.Scroll({ mask: true, over: true });
        var files = new Lampa.Explorer(object);
        var last;
        var started = false;

        var voiceGroups = {};
        var currentFolder = null; // null — кореневий рівень (вибір студії/озвучення), інакше — конкретна студія

        this.create = function () {
            files.appendFiles(scroll.render());
            return this.render();
        };

        this.start = function () {
            started = true;
            this.loading(true);
            this.loadPlaylist();
        };

        // Завантаження структури серій з локального бекенду
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
                    this.empty("Помилка завантаження плейлиста з бекенду.");
                }
            });
        };

        // Обробка отриманих від бекенду перекладів та варіантів озвучень
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

            var voiceKeys = Object.keys(voiceGroups);
            if (voiceKeys.length === 0) {
                this.empty("Не знайдено серій.");
                return;
            }

            // Якщо доступний лише один варіант озвучення, відображаємо серії одразу
            if (voiceKeys.length === 1) {
                this.renderEpisodes(voiceKeys[0]);
            } else {
                this.renderFolders();
            }
        };

        // Рендеринг папок з озвученнями
        this.renderFolders = function() {
            currentFolder = null;
            scroll.clear();

            var keys = Object.keys(voiceGroups);
            keys.forEach((key) => {
                var item = Lampa.Template.get('anitube_mod', {
                    title: key,
                    quality: 'Папка'
                });

                item.on('hover:enter', () => {
                    this.renderEpisodes(key);
                });

                this.append(item);
            });

            this.setFocus();
        };

        // Рендеринг серій всередині обраного озвучення
        this.renderEpisodes = function(voiceKey) {
            currentFolder = voiceKey;
            scroll.clear();

            // Кнопка повернення до озвучень, якщо їх більше ніж одне
            if (Object.keys(voiceGroups).length > 1) {
                var backItem = Lampa.Template.get('anitube_mod', {
                    title: '⬅ Назад до вибору озвучення',
                    quality: ''
                });
                backItem.on('hover:enter', () => {
                    this.renderFolders();
                });
                this.append(backItem);
            }

            var episodes = voiceGroups[voiceKey];
            episodes.forEach((ep) => {
                var item = Lampa.Template.get('anitube_mod', {
                    title: ep.name,
                    quality: 'HD'
                });

                item.on('hover:enter', () => {
                    this.loading(true);
                    this.getStreamUrl(ep.file, (streamUrl) => {
                        this.loading(false);
                        if (streamUrl) {
                            // Формування плейлиста з лінивим розширенням посилань для автопереходу
                            var playlist = episodes.map((e) => {
                                return {
                                    title: (object.movie.title || object.movie.name) + ' - ' + voiceKey + ' - ' + e.name,
                                    url: (call) => {
                                        this.getStreamUrl(e.file, (url) => call(url));
                                    }
                                };
                            });

                            var epIndex = episodes.indexOf(ep);
                            var firstPlayItem = {
                                title: (object.movie.title || object.movie.name) + ' - ' + voiceKey + ' - ' + ep.name,
                                url: streamUrl
                            };

                            var lampaPlaylist = playlist.map((p, idx) => {
                                if (idx === epIndex) return firstPlayItem;
                                return p;
                            });

                            Lampa.Player.play(firstPlayItem);
                            Lampa.Player.playlist(lampaPlaylist);
                        } else {
                            Lampa.Noty.show("Помилка: не вдалося отримати посилання на відеопотік.");
                        }
                    });
                });

                this.append(item);
            });

            this.setFocus();
        };

        // Запит до бекенду для отримання прямого посилання на відео
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
                back: () => {
                    this.back();
                }
            });
            Lampa.Controller.toggle('content');
        };

        this.back = function() {
            if (currentFolder !== null && Object.keys(voiceGroups).length > 1) {
                this.renderFolders();
            } else {
                Lampa.Activity.backward();
            }
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

    // Відкриття створеного нативного компонента
    function openComponent(item, movie) {
        Lampa.Activity.push({
            url: '',
            title: 'AniTube',
            component: 'anitube_component',
            item: item,
            movie: movie
        });
    }

    // Показує результати пошуку для вибору потрібної картки
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

    // Пошуковий запит до локального бекенду
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

    // Ініціалізація та додавання кнопки "AniTube" на сторінку опису фільму
    function initPlugin() {
        if (window.anitube_plugin_initialized) return;
        window.anitube_plugin_initialized = true;

        var manifest = {
            type: 'video',
            version: '1.1.0',
            name: 'AniTube.in.ua',
            description: 'Український онлайн-перегляд аніме через локальний бекенд',
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