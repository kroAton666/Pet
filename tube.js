(function () {
    'use strict';

    var activeProxies = [
        'https://cors557.deno.dev/',
        'https://cors.fx666.workers.dev/',
        'https://cors.nb557.workers.dev/'
    ];

    // Helper for requests supporting both direct TV app connections (CORS bypassed) and proxy fallbacks for browser users
    function ajaxRequest(options) {
        var url = options.url;
        var proxyIndex = options.proxyIndex !== undefined ? options.proxyIndex : -1;
        var useProxy = options.forceProxy;

        if (useProxy) {
            if (proxyIndex === -1) proxyIndex = 0;
            var proxy = activeProxies[proxyIndex % activeProxies.length];
            url = proxy + options.url;
        }

        $.ajax({
            url: url,
            type: options.type || 'GET',
            data: options.data,
            headers: options.headers || {},
            dataType: options.dataType || 'text',
            success: options.success,
            error: function(xhr, status, err) {
                // If it fails without a proxy, retry with proxy
                if (!useProxy) {
                    options.forceProxy = true;
                    options.proxyIndex = 0;
                    ajaxRequest(options);
                } else if (proxyIndex + 1 < activeProxies.length) {
                    // Try the next proxy in the list
                    options.proxyIndex = proxyIndex + 1;
                    ajaxRequest(options);
                } else {
                    if (options.error) options.error(xhr, status, err);
                }
            }
        });
    }

    // Clean titles to optimize search matching on DLE (DataLife Engine)
    function cleanTitle(title) {
        if (!title) return '';
        return title
            .replace(/[\s.,:;’'`!?]+/g, ' ')
            .replace(/[\(\)\[\]]+/g, ' ')
            .replace(/(сезон|season|\bтв-\d+\b)/gi, '')
            .trim();
    }

    // Parse HTML search results (supporting both DLE AJAX search popup format and standard search page)
    function parseSearchHtml(html) {
        var cleanHtml = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
        var doc = $('<div>' + cleanHtml + '</div>');
        var results = [];

        var links = doc.find('a');
        if (links.length > 0) {
            links.each(function() {
                var a = $(this);
                var url = a.attr('href');
                if (!url) return;

                var title = '';
                var titleEl = a.find('.sres-title, .searchheading, h2, b');
                if (titleEl.length) {
                    title = titleEl.first().text().trim();
                } else {
                    title = a.text().trim();
                }

                var poster = '';
                var img = a.find('img');
                if (img.length) {
                    poster = img.attr('src');
                }

                var desc = '';
                var descEl = a.find('.sres-desc, span:not(.searchheading)');
                if (descEl.length) {
                    desc = descEl.first().text().trim();
                }

                if (url && url.indexOf('http') !== 0) {
                    url = 'https://anitube.in.ua' + url;
                }

                if (title && url) {
                    results.push({
                        title: title,
                        url: url,
                        poster: poster,
                        desc: desc,
                        year: ''
                    });
                }
            });
        }

        if (results.length === 0) {
            doc.find('article.story').each(function() {
                var article = $(this);
                var titleEl = article.find('h2[itemprop="name"] a');
                if (!titleEl.length) titleEl = article.find('h2 a');

                var title = titleEl.text().trim();
                var url = titleEl.attr('href');

                var posterEl = article.find('span.story_post img');
                var poster = posterEl.length ? posterEl.attr('src') : '';
                if (poster && poster.indexOf('http') !== 0) {
                    poster = 'https://anitube.in.ua' + poster;
                }

                var descEl = article.find('div.story_c_text');
                var desc = descEl.length ? descEl.text().trim() : '';

                var year = '';
                article.find('div.story_infa dt').each(function() {
                    var label = $(this).text();
                    if (label.indexOf('Рік випуску') !== -1 || label.indexOf('Год') !== -1) {
                        year = $(this).next('dd').text().trim();
                    }
                });

                if (title && url) {
                    results.push({
                        title: title,
                        url: url,
                        poster: poster,
                        desc: desc,
                        year: year
                    });
                }
            });
        }
        return results;
    }

    // Extract playlists from detail pages (handles AJAX playlists and inline RalodePlayer script fallbacks)
    function getPlaylist(url, html, callback, error) {
        var newsIdMatch = url.match(/\/(\d+)-/);
        if (newsIdMatch) {
            var newsId = newsIdMatch[1];
            ajaxRequest({
                url: 'https://anitube.in.ua/engine/ajax/playlists.php?news_id=' + newsId + '&xfield=playlist',
                type: 'GET',
                dataType: 'json',
                success: function(data) {
                    if (data && data.success && data.response) {
                        parseAjaxPlaylist(data.response, callback);
                    } else {
                        parseInlinePlaylist(html, callback, error);
                    }
                },
                error: function() {
                    parseInlinePlaylist(html, callback, error);
                }
            });
        } else {
            parseInlinePlaylist(html, callback, error);
        }
    }

    function parseAjaxPlaylist(responseHtml, callback) {
        var doc = $('<div>' + responseHtml + '</div>');

        var folders = {};
        doc.find('.playlists-lists .playlists-items li').each(function() {
            var id = $(this).attr('data-id');
            var name = $(this).text().trim();
            folders[id] = name;
        });

        var episodes = [];
        doc.find('.playlists-videos .playlists-items li').each(function() {
            var id = $(this).attr('data-id');
            var name = $(this).text().trim();
            var file = $(this).attr('data-file');
            episodes.push({
                id: id,
                name: name,
                file: file
            });
        });

        if (episodes.length === 0) {
            callback({});
            return;
        }

        callback(buildPlaylistTree(folders, episodes));
    }

    function buildPlaylistTree(folders, episodes) {
        var voiceGroups = {};

        episodes.forEach(function(ep) {
            var parts = ep.id.split('_');
            var voiceName = 'Стандартне озвучення';
            var seasonName = 'Сезон 1';

            if (parts.length >= 1) {
                var voiceId = parts[0];
                voiceName = folders[voiceId] || voiceName;
            }

            if (parts.length >= 3) {
                var seasonId = parts[0] + '_' + parts[1];
                seasonName = folders[seasonId] || ('Сезон ' + (parseInt(parts[1]) + 1));
            }

            if (!voiceGroups[voiceName]) voiceGroups[voiceName] = {};
            if (!voiceGroups[voiceName][seasonName]) voiceGroups[voiceName][seasonName] = [];

            voiceGroups[voiceName][seasonName].push({
                name: ep.name,
                file: ep.file
            });
        });

        return voiceGroups;
    }

    function parseInlinePlaylist(html, callback, error) {
        var scriptMatch = html.match(/RalodePlayer\.init\(([^,]+),\s*(\[\[[\s\S]*?\]\])\)/);
        if (!scriptMatch) {
            var iframeMatch = html.match(/<iframe\b[^>]*src=["'](https?:\/\/[^"']+)["']/i);
            if (iframeMatch) {
                var voiceGroups = {};
                voiceGroups['Стандартне озвучення'] = {};
                voiceGroups['Стандартне озвучення']['Сезон 1'] = [{
                    name: 'Відео',
                    file: iframeMatch[1]
                }];
                callback(voiceGroups);
                return;
            }
            if (error) error("Не знайдено плеєр на сторінці.");
            return;
        }

        try {
            var tabs = JSON.parse(scriptMatch[1]);
            var playlists = JSON.parse(scriptMatch[2]);
            var voiceGroups = {};

            for (var t = 0; t < tabs.length; t++) {
                var voiceName = tabs[t] || 'Стандартне озвучення';
                var episodes = playlists[t] || [];

                if (!voiceGroups[voiceName]) voiceGroups[voiceName] = {};

                var seasonName = 'Сезон 1';
                voiceGroups[voiceName][seasonName] = [];

                episodes.forEach(function(ep) {
                    var srcMatch = ep.code.match(/src=["'](https?:\/\/[^"']+)["']/i);
                    var fileUrl = srcMatch ? srcMatch[1] : '';
                    if (fileUrl) {
                        voiceGroups[voiceName][seasonName].push({
                            name: ep.name,
                            file: fileUrl
                        });
                    }
                });
            }
            callback(voiceGroups);
        } catch(e) {
            if (error) error("Помилка парсингу RalodePlayer: " + e.message);
        }
    }

    // Direct Stream Resolvers (Ashdi, CSST, Tortuga)
    function resolveAshdi(iframeUrl, callback, error) {
        ajaxRequest({
            url: iframeUrl,
            type: 'GET',
            success: function(html) {
                var playerjsMatch = html.match(/Playerjs\(([^)]+)\)/);
                if (playerjsMatch) {
                    try {
                        var config = JSON.parse(playerjsMatch[1].trim());
                        if (config.file) {
                            callback(config.file);
                            return;
                        }
                    } catch(e) {}
                }

                var m3u8Match = html.match(/["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/i);
                if (m3u8Match) {
                    callback(m3u8Match[1]);
                } else {
                    error("Не вдалося знайти посилання (.m3u8) в Ashdi.");
                }
            },
            error: function() {
                error("Помилка завантаження плеєра Ashdi.");
            }
        });
    }

    function resolveCsst(iframeUrl, callback, error) {
        ajaxRequest({
            url: iframeUrl,
            type: 'GET',
            success: function(html) {
                var playerjsMatch = html.match(/Playerjs\(([^)]+)\)/);
                if (playerjsMatch) {
                    try {
                        var config = JSON.parse(playerjsMatch[1].trim());
                        var file = config.file || '';
                        if (file) {
                            if (file.indexOf(',') !== -1) {
                                var streams = {};
                                var parts = file.split(',');
                                parts.forEach(function(part) {
                                    var match = part.match(/\[([^\]]+)\](https?:\/\/[^"'\s]+)/);
                                    if (match) {
                                        streams[match[1]] = match[2];
                                    }
                                });

                                var keys = Object.keys(streams);
                                if (keys.length > 0) {
                                    keys.sort(function(a, b) {
                                        return (parseInt(b) || 0) - (parseInt(a) || 0);
                                    });
                                    callback(streams[keys[0]]); // Plays highest resolution by default
                                    return;
                                }
                            } else {
                                callback(file);
                                return;
                            }
                        }
                    } catch(e) {}
                }

                var m3u8Match = html.match(/["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/i);
                if (m3u8Match) {
                    callback(m3u8Match[1]);
                } else {
                    error("Не вдалося знайти посилання (.m3u8) в CSST.");
                }
            },
            error: function() {
                error("Помилка завантаження плеєра CSST.");
            }
        });
    }

    function decryptTortuga(base64Str) {
        try {
            var clean = base64Str.replace(/==$/, '').replace(/\s+/g, '');
            var decoded = atob(clean);
            return decoded.split('').reverse().join('');
        } catch(e) {
            return '';
        }
    }

    function resolveTortuga(iframeUrl, callback, error) {
        var resolvedUrl = iframeUrl;
        if (resolvedUrl.indexOf('tortuga') !== -1) {
            resolvedUrl = resolvedUrl.replace(/https:\/\/tortuga\.[a-z]{2,3}\/vod\/(\d+\w*)/, "https://tortuga.tw/vod/$1");
        }

        ajaxRequest({
            url: resolvedUrl,
            type: 'GET',
            success: function(html) {
                var fileMatch = html.match(/file\s*:\s*["']([^"']+)["']/);
                if (fileMatch) {
                    var decrypted = decryptTortuga(fileMatch[1]);
                    if (decrypted) {
                        callback(decrypted);
                        return;
                    }
                }

                var m3u8Match = html.match(/["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/i);
                if (m3u8Match) {
                    callback(m3u8Match[1]);
                } else {
                    error("Не вдалося знайти посилання (.m3u8) в Tortuga.");
                }
            },
            error: function() {
                error("Помилка завантаження плеєра Tortuga.");
            }
        });
    }

    function resolveStreamUrl(iframeUrl, callback, error) {
        if (!iframeUrl) {
            error("Пусте посилання на відео.");
            return;
        }

        if (iframeUrl.indexOf('.m3u8') !== -1 || iframeUrl.indexOf('.mp4') !== -1) {
            callback(iframeUrl);
            return;
        }

        $.ajax({
            url: 'http://192.168.0.4:3000/api/lamp/extract-video?url=' + encodeURIComponent(iframeUrl),
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
                    error("Не вдалося отримати посилання на відео з відповіді бекенду.");
                }
            },
            error: function(xhr, status, err) {
                error("Помилка запиту на екстракцію відео з бекенду.");
            }
        });
    }

    // Unified interactive UI controller via native Select dialogs
    function selectVoiceActing(voiceGroups, movie) {
        var voices = Object.keys(voiceGroups);
        if (voices.length === 0) {
            Lampa.Noty.show("Не знайдено жодного озвучення/відео на AniTube.");
            return;
        }

        if (voices.length === 1) {
            selectSeason(voiceGroups, voices[0], movie);
            return;
        }

        var controller = Lampa.Controller.enabled().name;

        Lampa.Select.show({
            title: "Озвучення / Переклад",
            items: voices.map(function(voice, index) {
                return {
                    title: voice,
                    selected: index === 0,
                    voice: voice
                };
            }),
            onSelect: function(item) {
                Lampa.Controller.toggle(controller);
                selectSeason(voiceGroups, item.voice, movie);
            },
            onBack: function() {
                Lampa.Controller.toggle(controller);
            }
        });
    }

    function selectSeason(voiceGroups, voiceName, movie) {
        var seasons = Object.keys(voiceGroups[voiceName]);
        if (seasons.length === 0) {
            Lampa.Noty.show("Не знайдено сезонів.");
            return;
        }

        if (seasons.length === 1) {
            selectEpisode(voiceGroups, voiceName, seasons[0], movie);
            return;
        }

        var controller = Lampa.Controller.enabled().name;

        Lampa.Select.show({
            title: "Сезон",
            items: seasons.map(function(season, index) {
                return {
                    title: season,
                    selected: index === 0,
                    season: season
                };
            }),
            onSelect: function(item) {
                Lampa.Controller.toggle(controller);
                selectEpisode(voiceGroups, voiceName, item.season, movie);
            },
            onBack: function() {
                Lampa.Controller.toggle(controller);
                selectVoiceActing(voiceGroups, movie);
            }
        });
    }

    function selectEpisode(voiceGroups, voiceName, seasonName, movie) {
        var episodes = voiceGroups[voiceName][seasonName];
        if (episodes.length === 0) {
            Lampa.Noty.show("Не знайдено серій.");
            return;
        }

        var controller = Lampa.Controller.enabled().name;

        Lampa.Select.show({
            title: "Серія",
            items: episodes.map(function(ep, index) {
                return {
                    title: ep.name,
                    selected: index === 0,
                    episode: ep
                };
            }),
            onSelect: function(item) {
                Lampa.Controller.toggle(controller);
                Lampa.Loading.start();

                resolveStreamUrl(item.episode.file, function(streamUrl) {
                    Lampa.Loading.stop();

                    var playTitle = (movie.title || movie.name) + ' - ' + voiceName + ' - ' + item.episode.name;

                    // Create playlist items. Uses just-in-time dynamic resolution callback for subsequent files!
                    var playlist = episodes.map(function(e) {
                        return {
                            url: function(cb) {
                                resolveStreamUrl(e.file, function(resolvedUrl) {
                                    cb({ url: resolvedUrl });
                                }, function() {
                                    cb({ url: e.file });
                                });
                            },
                            title: (movie.title || movie.name) + ' - ' + voiceName + ' - ' + e.name
                        };
                    });

                    var currentIndex = episodes.indexOf(item.episode);
                    var currentPlayItem = {
                        url: streamUrl,
                        title: playTitle
                    };

                    Lampa.Player.play(currentPlayItem);

                    var lampaPlaylist = playlist.map(function(p, i) {
                        if (i === currentIndex) return currentPlayItem;
                        return p;
                    });

                    Lampa.Player.playlist(lampaPlaylist);

                }, function(err) {
                    Lampa.Loading.stop();
                    Lampa.Noty.show("Помилка: " + err);
                });
            },
            onBack: function() {
                Lampa.Controller.toggle(controller);
                selectSeason(voiceGroups, voiceName, movie);
            }
        });
    }

    function showSearchResults(results, movie) {
        if (results.length === 1) {
            loadAnimeDetails(results[0], movie);
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
                loadAnimeDetails(selected.item, movie);
            },
            onBack: function() {
                Lampa.Controller.toggle(controller);
            }
        });
    }

    function loadAnimeDetails(item, movie) {
        Lampa.Loading.start();

        var url = 'http://192.168.0.4:3000/api/lamp/play-list?id=' + encodeURIComponent(item.id) + '&pageUrl=' + encodeURIComponent(item.url);

        $.ajax({
            url: url,
            type: 'GET',
            dataType: 'json',
            success: function(data) {
                Lampa.Loading.stop();
                if (data && data.success && data.translations) {
                    try {
                        var voiceGroups = {};

                        data.translations.forEach(function(trans) {
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
                                                if (!voiceGroups[voiceKey]) {
                                                    voiceGroups[voiceKey] = {};
                                                }
                                                var seasonKey = 'Серії';
                                                voiceGroups[voiceKey][seasonKey] = player.episodes.map(function(ep) {
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

                        selectVoiceActing(voiceGroups, movie);
                    } catch(e) {
                        Lampa.Noty.show("Помилка обробки плейлиста: " + e.message);
                    }
                } else {
                    Lampa.Noty.show("Невірний формат плейлиста від бекенду.");
                }
            },
            error: function(xhr, status, err) {
                Lampa.Loading.stop();
                Lampa.Noty.show("Помилка завантаження плейлиста з бекенду.");
            }
        });
    }

    function performSearch(query, callback, error) {
        $.ajax({
            url: 'http://192.168.0.4:3000/api/lamp/get-list?searchQuery=' + encodeURIComponent(query),
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
                // Search original title fallback
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

    // Initialize Plugin
    function initPlugin() {
        if (window.anitube_plugin_initialized) return;
        window.anitube_plugin_initialized = true;

        var manifest = {
            type: 'video',
            version: '1.0.0',
            name: 'AniTube.in.ua',
            description: 'Український онлайн-перегляд аніме з сайту anitube.in.ua',
            component: 'anitube_view'
        };
        Lampa.Manifest.plugins = manifest;

        // Details page hook
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
                    // Force refresh template navigation so Lampa's focus engine registers the new button immediately
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
