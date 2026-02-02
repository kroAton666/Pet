(function () {
    'use strict';

    function startPlugin() {
        // Підписуємося на подію відкриття картки (full)
        Lampa.Listener.follow('full', 'open', function (data) {
            // data.object - це об'єкт з інформацією про фільм (назва, id, рік тощо)
            // data.component - посилання на сам компонент картки
            
            let object = data.object;
            let component = data.component;

            // Створюємо кнопку
            let btn = $(`<div class="full-start__button selector view--online" data-subtitle="My Source">
                <svg>...</svg> <!-- Тут можна вставити SVG іконку -->
                <span>Дивитись MySource</span>
                </div>`);

            // Додаємо дію при натисканні
            btn.on('click hover:enter', function () {
                // Тут логіка пошуку відео
                // Наприклад, ми робимо запит до вашого API або парсимо сайт
                searchAndPlay(object);
            });

            // Вставляємо кнопку в інтерфейс (блок кнопок)
            component.find('.full-start__buttons').append(btn);
        });
    }

    function searchAndPlay(movie) {
        // Демонстрація: просто запускаємо тестове відео
        // У реальності тут має бути fetch/ajax запит до вашого джерела
        
        Lampa.Noty.show('Шукаю відео для: ' + movie.title);

        // Симуляція затримки мережі
        setTimeout(function(){
            
            // Запуск плеєра
            Lampa.Player.play({
                url: 'https://ashdi.vip/vod/76952', // Ваше посилання на відео (m3u8/mp4)
                title: 'Blu lock',// movie.title, // Назва у плеєрі
                poster: 'https://uakino.best/uploads/mini/serial/d2/9c965394d605d52d4f4896cae3b727.webp'//movie.img,  // Постер (якщо є)
                timeline: {
                    // Якщо потрібно зберегти час перегляду
                    hash: Lampa.Utils.hash('Blu lock'), //movie.title // унікальний ID
                    time: 0 
                }
            });

            // Додаємо в плейлист (щоб працювала кнопка "наступна серія" абощо)
            Lampa.Player.playlist([
                {
                    url: 'https://ashdi.vip/vod/77157',
                    title: 'bluLock 2' // movie.title
                },
                {
                    url: 'https://ashdi.vip/vod/77927',
                    title: 'bluLock 3' // movie.title
                }
            ]);
            
        }, 1000);
    }

    if (window.appready) startPlugin();
    else Lampa.Listener.follow('app', 'ready', startPlugin);
})();
