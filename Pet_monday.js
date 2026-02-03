(function () {
    'use strict';

    function startPlugin() {
        // Чекаємо відкриття картки фільму
        Lampa.Listener.follow('full', 'open', function (data) {
            var object = data.object;
            var component = data.component;

            // Створюємо кнопку "по-старому" (через плюсики), щоб WebOS точно зрозумів
            var html = '<div class="full-start__button selector view--online" data-subtitle="My Source">' +
                '<svg width="20" height="20" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">' +
                '<path d="M8 5V19L19 12L8 5Z" fill="currentColor"/>' +
                '</svg>' +
                '<span>Дивитись MySource</span>' +
                '</div>';

            var btn = $(html);

            // Дія при кліку
            btn.on('click hover:enter', function () {
                searchAndPlay(object);
            });

            // Додаємо кнопку на екран
            component.find('.full-start__buttons').append(btn);
        });
    }

    function searchAndPlay(movie) {
        Lampa.Noty.show('Запуск відео: ' + movie.title);

        var streamUrl = 'https://ashdi.vip/video02/3/serials/blue_lock/sinya_vyazniczya__01_76952/hls/DK6XiHOKjuRemBH9Ag==/index.m3u8';

        // Запуск плеєра
        Lampa.Player.play({
            url: streamUrl,
            title: movie.title,
            poster: movie.img,
            timeline: {
                hash: Lampa.Utils.hash(movie.title),
                time: 0
            }
        });

        // Додаємо в плейлист
        Lampa.Player.playlist([{
            url: streamUrl,
            title: movie.title
        }]);
    }

    // Запуск плагіна
    if (window.appready) startPlugin();
    else Lampa.Listener.follow('app', 'ready', startPlugin);
})();