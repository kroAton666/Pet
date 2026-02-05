// Назва плагіна: UakinoBest
// Версія: 1.1
// Опис: Плагін для перегляду з сайту uakino.best

(function () {
    'use strict';

    // Функція для запуску плагіна
    function startPlugin() {
        // Реєструємо компонент в Lampa
        Lampa.Component.add('uakino_component', function(object) {
            console.log('uakino_component: Компонент успішно запущено!');
            var network = new Lampa.Reguest();
            var scroll = new Lampa.Scroll({ mask: true, over: true });
            var files = new Lampa.Explorer(object);

            // Створюємо екземпляр нашого балансера
            var source = new uakino(this, object);
            var last;

            this.create = function () {
                this.activity.loader(true);
                files.appendFiles(scroll.render());
                this.search(); // Запускаємо пошук
                return this.render();
            };

            this.search = function () {
                this.activity.loader(true);
                this.reset();
                source.search(object.movie.title, object.movie.original_title);
            };

            // Допоміжні функції для взаємодії з інтерфейсом Lampa
            this.empty = function(msg) {
                var empty = Lampa.Template.get('list_empty');
                if (msg) empty.find('.empty__descr').text(msg);
                scroll.append(empty);
                this.loading(false);
            };
            this.loading = function(status) {
                if (status) this.activity.loader(true);
                else this.activity.loader(false);
            };
            this.reset = function() {
                scroll.clear();
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
            this.start = function(first_select) {
                if (first_select) {
                    last = scroll.render().find('.selector').eq(0)[0];
                }
                Lampa.Controller.add('content', {
                    toggle: () => {
                        Lampa.Controller.collectionSet(scroll.render(), files.render());
                        Lampa.Controller.collectionFocus(last || false, scroll.render());
                    },
                    up: () => Lampa.Controller.toggle('head'),
                    down: () => Navigator.move('down'),
                    back: this.back
                });
                Lampa.Controller.toggle('content');
            };
            this.back = function() { Lampa.Activity.backward(); };
            this.destroy = function () {
                network.clear();
                files.destroy();
                scroll.destroy();
                source.destroy();
            };
        });

        // Логіка балансера для uakino.best
        function uakino(component, _object) {
            var network = new Lampa.Reguest();
            var object = _object;
            var HOST = 'https://uakino.best';
            var SEARCH_API = HOST + '/engine/lazydev/dle_search/ajax.php';
            // Цей хеш може змінитися в майбутньому, тоді його потрібно буде оновити
            var DLE_HASH = '8018336ddfb7bab82040aba79ce3188e1d05511c';

            this.destroy = function () {
                network.clear();
            };

            // Крок 1: Пошук фільму на сайті
            this.search = function (title, original_title) {
                var story = encodeURIComponent(title);
                var post_data = `story=${story}&dle_hash=${DLE_HASH}&thisUrl=/`;
                getPage('kkkk')

                /*network.post(SEARCH_API, post_data, (search_html) => {
                    var parser = new DOMParser();
                    var doc = parser.parseFromString(search_html, "text/html");
                    var results = doc.querySelectorAll('a.sres-url');

                    if (results.length > 0) {
                        // Проста логіка вибору найкращого результату
                        var best_match = null;
                        var title_lower = title.toLowerCase();
                        var original_title_lower = original_title.toLowerCase();

                        results.forEach(link => {
                            var link_title = link.querySelector('.sres-title').textContent.toLowerCase();
                            var link_original_title = link.querySelector('.sres-original').textContent.toLowerCase();
                            if(link_title.includes(title_lower) || link_original_title.includes(original_title_lower)) {
                                if(!best_match) best_match = link.href;
                            }
                        });

                        if(best_match){
                            getPage(best_match);
                        } else {
                            // Якщо точного збігу немає, беремо перший результат
                            getPage(results[0].href);
                        }
                    } else {
                        component.empty(`За запитом '${title}' нічого не знайдено.`);
                    }
                }, (a, c) => {
                    component.empty('Помилка пошуку. ' + network.errorDecode(a,c));
                });*/
            };

            // Крок 2: Отримання сторінки фільму/серіалу для пошуку плеєра
            function getPage(movieUrl) {
                var items = [];
                var episode_links = [
                    {
                        title: 'test 1',
                        episode: 0,
                        iframeSrc: 'https://ashdi.vip/video03/3/serials/blue_lock/sinya_vyazniczya__01_76952/hls/DK6XiHOKjuRemBH9Ag==/index.m3u8'
                    },
                    {
                        title: 'test 2',
                        episode: 0,
                        iframeSrc: 'https://ashdi.vip/video05/2/serials/blue_lock/bl2_02online_146444/hls/DK6XiHOKjuRemBH9Ag==/index.m3u8'
                    }
                ]//doc.querySelectorAll('.serial-series-box > li > a');

                if (episode_links.length > 0) { // Це серіал
                    episode_links.forEach((link, index) => {
                        items.push({
                            title: link.title, //link.textContent.trim(),
                            episode: index + 1,
                            iframeSrc: link.iframeSrc //link.getAttribute('onclick').match(/'([^']+)'/)[1] // Витягуємо URL з onclick
                        });
                    });
                }
                if (items.length > 0) {
                    append(items);
                } else {
                    component.empty('Плеєр не знайдено на сторінці.');
                }
               /* network.get(movieUrl, (page_html) => {
                    var items = [];
                    var parser = new DOMParser();
                    var doc = parser.parseFromString(page_html, "text/html");

                    // Перевіряємо, чи це серіал (чи є вибір серій)
                    var episode_links = [
                        {
                            title: 'test 1',
                            episode: 0,
                            iframeSrc: 'https://ashdi.vip/video03/3/serials/blue_lock/sinya_vyazniczya__01_76952/hls/DK6XiHOKjuRemBH9Ag==/index.m3u8'
                        },
                        {
                            title: 'test 2',
                            episode: 0,
                            iframeSrc: 'https://ashdi.vip/video05/2/serials/blue_lock/bl2_02online_146444/hls/DK6XiHOKjuRemBH9Ag==/index.m3u8'
                        }
                    ]//doc.querySelectorAll('.serial-series-box > li > a');

                    if (episode_links.length > 0) { // Це серіал
                        episode_links.forEach((link, index) => {
                            items.push({
                                title: link.title, //link.textContent.trim(),
                                episode: index + 1,
                                iframeSrc: link.iframeSrc //link.getAttribute('onclick').match(/'([^']+)'/)[1] // Витягуємо URL з onclick
                            });
                        });
                    } /!*else { // Це фільм
                        var iframe = doc.querySelector('iframe#playerfr');
                        if (iframe) {
                            items.push({
                                title: object.movie.title,
                                episode: 0, // ознака фільму
                                iframeSrc: iframe.src
                            });
                        }
                    }*!/

                    if (items.length > 0) {
                        append(items);
                    } else {
                        component.empty('Плеєр не знайдено на сторінці.');
                    }
                }, (a, c) => {
                    component.empty('Не вдалося завантажити сторінку фільму.');
                });*/
            }

            // Крок 3: Отримання фінального посилання на потік
            function getStream(element, callback) {
                // Якщо посилання вже отримано, повертаємо його
                if (element.stream) return callback();

                // Додаємо протокол, якщо його немає
                var iframeUrl = element.iframeSrc.startsWith('//') ? 'https:' + element.iframeSrc : element.iframeSrc;

                network.get(iframeUrl, (player_html) => {
                    var parser = new DOMParser();
                    var doc = parser.parseFromString(player_html, "text/html");
                    var video_tag = doc.querySelector('video');

                    if (video_tag && video_tag.src) {
                        element.stream = video_tag.src;
                        callback();
                    } else {
                        Lampa.Noty.show('Не вдалося отримати посилання на відеопотік.');
                        component.loading(false);
                    }
                }, (a, c) => {
                    Lampa.Noty.show('Помилка завантаження плеєра.');
                    component.loading(false);
                });
            }

            // Відображення списку серій/фільму в інтерфейсі Lampa
            function append(items) {
                console.log('append')
                component.reset();
                items.forEach(element => {
                    var item = Lampa.Template.get('online_mod', {
                        title: element.title,
                        quality: 'HD' // Можна залишити статично, бо якість невідома
                    });

                    item.on('hover:enter', () => {
                        element.loading = true;
                        getStream(element, () => {
                            element.loading = false;

                            var playlist = [];
                            var first = {
                                url: element.stream,
                                title: element.title
                            };

                            // Якщо це серіал, створюємо плейлист
                            if(items.length > 1){
                                items.forEach(elem => {
                                    var cell = {
                                        title: elem.title,
                                        url: (call) => {
                                            getStream(elem, () => call(elem.stream));
                                        }
                                    };
                                    if(elem === element) playlist.unshift(cell);
                                    else playlist.push(cell);
                                });
                            } else {
                                playlist.push(first);
                            }

                            Lampa.Player.play(first);
                            Lampa.Player.playlist(playlist);
                        });
                    });
                    component.append(item);
                });
                component.loading(false);
                component.start(true);
            }
        }

        // Додаємо кнопку "Онлайн" до карток фільмів
        Lampa.Listener.follow('full', function (e) {
            if (e.type == 'complite') {
                var btn = $(`
                    <div class="full-start__button selector view--online">
                        <svg version="1.1" id="Capa_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" viewBox="0 0 477.867 477.867" style="enable-background:new 0 0 477.867 477.867;" xml:space="preserve"><g><path d="M452.267,24.043c-15.893-15.893-41.653-15.893-57.547,0L24.043,394.709c-15.893,15.893-15.893,41.653,0,57.547 c7.947,7.947,18.347,11.92,28.773,11.92s20.827-3.973,28.773-11.92L452.267,81.589C468.16,65.696,468.16,39.936,452.267,24.043z"/><path d="M452.267,24.043c-15.893-15.893-41.653-15.893-57.547,0L24.043,394.709c-15.893,15.893-15.893,41.653,0,57.547 c7.947,7.947,18.347,11.92,28.773,11.92s20.827-3.973,28.773-11.92L452.267,81.589C468.16,65.696,468.16,39.936,452.267,24.043z"/></g></svg>
                        <span>Uakino</span>
                    </div>`);

                btn.on('hover:enter', function () {
                    console.log('push btn')
                    Lampa.Activity.push({
                        url: '',
                        title: 'Uakino',
                        component: 'uakino_component',
                        movie: e.data.movie,
                    });
                });
                e.object.activity.render().find('.view--torrent').after(btn);
            }
        });

        // Створюємо шаблони, якщо вони не існують
        // if (!Lampa.Template.get('online_mod')) {
        //     Lampa.Template.add('online_mod', `
        //         <div class="online selector">
        //             <div class="online__body">
        //                 <div class="online__title">{title}</div>
        //                 <div class="online__quality">{quality}</div>
        //             </div>
        //         </div>
        //     `);
        // }
        console.log('plugin is start', Lampa)
    }

    // Запускаємо плагін
    if (window.appready) startPlugin();
    else {
        Lampa.Listener.follow('app', function (e) {
            if (e.type == 'ready') startPlugin();
        });
    }

})();