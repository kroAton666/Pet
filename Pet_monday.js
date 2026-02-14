// Назва плагіна: UakinoBest
// Версія: 1.1
// Опис: Плагін для перегляду з сайту uakino.best

(function () {
    'use strict';

    // Функція для запуску плагіна
    function startPlugin() {
        // Реєструємо компонент в Lampa
        Lampa.Component.add('uakino_component', function(object) {
            var network = new Lampa.Reguest();
            var scroll = new Lampa.Scroll({ mask: true, over: true });
            var files = new Lampa.Explorer(object);
            var source = new uakino(this, object);
            var last;
            var started = false; // Прапорець, щоб знати, чи компонент вже стартував

            // Метод для відображення даних, які поверне балансер
            function renderItems(items) {
                console.log("renderItems: Отримано", items.length, "елементів для відображення.");

                // Очищуємо попередні результати
                scroll.clear();

                items.forEach(element => {
                    var item = Lampa.Template.get('online_mod', {
                        title: element.title,
                        quality: 'HD'
                    });

                   /* item.on('hover:enter', () => {
                        source.getStream(element, (streamUrl) => {
                            if (streamUrl) {
                                var playlist = [];
                                var first = {
                                    url: streamUrl,
                                    title: element.title
                                };

                                playlist.push(first);

                                if (items.length > 1) {
                                    items.forEach(elem => {
                                        if (elem !== element) {
                                            playlist.push({
                                                title: elem.title,
                                                url: (call) => {
                                                    source.getStream(elem, (url) => call(url));
                                                }
                                            });
                                        }
                                    });
                                }

                                Lampa.Player.play(playlist[0]);
                                Lampa.Player.playlist(playlist);
                            }
                        });
                    });

                    // Використовуємо локальний 'scroll', а не 'component.append'
                    item.on('hover:focus', (e) => {
                        last = e.target;
                        scroll.update($(e.target), true);
                    });
                    scroll.append(item);*/
                });

                // Після того, як все додали, вимикаємо завантажувач і показуємо контент
                this.loading(false);

                // FIX: Після рендерингу, якщо компонент вже стартував, просто встановлюємо фокус.
                // Якщо ще ні - це означає, що це перший рендер, і start ще не викликався.
                if (started) {
                    this.setFocus();
                }
            };

            this.setFocus = function() {
                last = scroll.render().find('.selector').eq(0)[0];
                Lampa.Controller.add('content', {
                    toggle: () => {
                        Lampa.Controller.collectionSet(scroll.render(), files.render());
                        Lampa.Controller.collectionFocus(last || false, scroll.render());
                    },
                    up: () => (Navigator.canmove('up')) ? Navigator.move('up') : Lampa.Controller.toggle('head'),
                    down: () => Navigator.move('down'),
                    back: this.back.bind(this) // FIX: Прив'язуємо контекст для 'back'
                });
                Lampa.Controller.toggle('content');
            };
            this.create = function () {
                source.onResults = renderItems.bind(this);
                source.onEmpty = this.empty.bind(this);
                source.onLoading = this.loading.bind(this);

                files.appendFiles(scroll.render());
                return this.render();
            };

            this.start = function () {
                started = true; // Встановлюємо прапорець
                this.setFocus(); // Налаштовуємо фокус і контролер
                this.search();   // Запускаємо початковий пошук
            };

            this.search = function () {
                this.loading(true);
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
            /*this.start = function(first_select) {
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
            };*/
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

            this.onResults = function(items) {};
            this.onEmpty = function(msg) {};
            this.onLoading = function(bool) {};

            this.destroy = function () { network.clear(); };

            this.search = function (title, original_title) {
                console.log('uakino function start')
                this.getPage('kkkk');
            };

            // FIX: Зробив getPage методом екземпляра
            this.getPage = function(movieUrl) {
                console.log('gar page start')
                var items = [
                    { title: 'Тестова серія 1', episode: 1, iframeSrc: '//ashdi.vip/vod/145231?' },
                    { title: 'Тестова серія 2', episode: 2, iframeSrc: '//ashdi.vip/vod/146444?' }
                ];
                console.log('gae page middle')
                if (items.length > 0) {
                    this.onResults(items);
                } else {
                    this.onEmpty('Плеєр не знайдено на сторінці.');
                }
                console.log('get page finish')
            }

            this.getStream = function(element, callback) {
                if (element.stream) return callback(element.stream);

                this.onLoading(true);
                var iframeUrl = element.iframeSrc.startsWith('//') ? 'https:' + element.iframeSrc : element.iframeSrc;

                network.get(iframeUrl, (player_html) => {
                    this.onLoading(false);
                    var parser = new DOMParser();
                    var doc = parser.parseFromString(player_html, "text/html");
                    var video_tag = doc.querySelector('video');

                    if (video_tag && video_tag.src) {
                        element.stream = video_tag.src;
                        callback(element.stream);
                    } else {
                        Lampa.Noty.show('Не вдалося отримати посилання на відеопотік.');
                        callback(null);
                    }
                }, (a, c) => {
                    this.onLoading(false);
                    Lampa.Noty.show('Помилка завантаження плеєра (можливо, CORS).');
                    callback(null);
                });
            };
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
                        title: 'Привіт Руслан',
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