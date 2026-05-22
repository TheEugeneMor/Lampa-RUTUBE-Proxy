# Lampa RUTUBE Proxy Server

Автор: Eugene Pchelnikov. Связь в Telegram: [@eugenemor](https://t.me/eugenemor).

Эта папка - серверная часть плагина. Ее можно положить в корень сайта или в любой подкаталог, где веб-сервер выполняет PHP.

## Требования

- PHP 8.1+ должен выполняться в каталоге с файлами плагина.
- Желательно расширения `curl` и `openssl`.

## URL для Lampa

Если файлы лежат в подкаталоге, добавьте в Lampa прямой URL файла `rt.js`:

```text
https://your-domain.example/your-plugin-dir/rt.js
```

Если файлы лежат в корне сайта, используйте:

```text
https://your-domain.example/rt.js
```

## Размещение

Для работы достаточно прямого доступа к файлам:

```text
https://your-domain.example/your-plugin-dir/rt.js
https://your-domain.example/your-plugin-dir/proxy.php
https://your-domain.example/your-plugin-dir/stream.php
https://your-domain.example/your-plugin-dir/hls.php
```

Файл `rt.js` сам определяет базовый адрес по своему URL. Поэтому при подключении `https://your-domain.example/your-plugin-dir/rt.js` запросы автоматически пойдут в тот же каталог: `proxy.php`, `stream.php` и `hls.php`.

Файл `index.php` нужен только для удобной проверки каталога плагина в браузере.

Минимальный набор файлов для загрузки:

```text
index.php
status.php
rt.js
proxy.php
stream.php
hls.php
```

Файл `router.php` нужен только для встроенного PHP-сервера из локальных запускателей. На обычный хостинг его можно не загружать, если вы используете прямые URL выше.

Если внутри основного сайта уже есть свой конфиг веб-сервера, его трогать не нужно. Загрузите файлы плагина в любой доступный каталог и подключайте прямой URL `rt.js`.

## Проверка

Если главная страница открывается, а в Lampa в статусе 404, проверьте напрямую:

```text
https://your-domain.example/your-plugin-dir/
https://your-domain.example/your-plugin-dir/rt.js
https://your-domain.example/your-plugin-dir/proxy.php?q=test
https://your-domain.example/your-plugin-dir/stream.php?id=test
```

- каталог плагина должен показать статусную страницу с адресом плагина;
- `rt.js` должен показать JavaScript-код;
- `proxy.php?q=test` должен вернуть JSON с результатами RUTUBE;
- `stream.php?id=test` должен вернуть JSON с ошибкой `Invalid video id` и HTTP 400. Это нормально, потому что `test` - не настоящий RUTUBE id.

Если `proxy.php` или `stream.php` отдают обычную страницу 404 хостинга, запрос не дошел до PHP-скрипта: в каталоге плагина не выполняется PHP или основной конфиг сайта перехватывает этот путь.

Если `proxy.php?q=test` отдает 502, PHP работает, но хостинг не может сходить до RUTUBE или не хватает `curl`/`openssl`.
