(function () {
    'use strict';

    function startPlugin() {
        // Підписуємося на подію відкриття картки
        Lampa.Listener.follow('full', 'open', function (data) {
            var object = data.object;
            var component = data.component;

            // Створюємо кнопку з реальною іконкою (Play)
            var btn = $(
                '<div class="full-start__button selector view--online" data-subtitle="My Source">' +
                '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>' +
                '<span>Дивитись MySource</span>' +
                '</div>'
            );

            // Додаємо дію при натисканні (підтримка миші і пульта)
            btn.on('click hover:enter', function () {
                searchAndPlay(object);
            });

            // Вставляємо кнопку перед іншими або в кінець списку
            component.find('.full-start__buttons').append(btn);
        });
    }

    function searchAndPlay(movie) {
        Lampa.Noty.show('Запуск відео: ' + movie.title);

        // Пряме посилання на відео (Ваш приклад)
        var streamUrl = 'https://ashdi.vip/video02/3/serials/blue_lock/sinya_vyazniczya__01_76952/hls/DK6XiHOKjuRemBH9Ag==/index.m3u8';

        Lampa.Player.play({
            url: streamUrl,
            title: movie.title,
            poster: movie.img,
            timeline: {
                hash: Lampa.Utils.hash(movie.title),
                time: 0
            }
        });

        Lampa.Player.playlist([{
            url: streamUrl,
            title: movie.title
        }]);
    }

    if (window.appready) startPlugin();
    else Lampa.Listener.follow('app', 'ready', startPlugin);
})();