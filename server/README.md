# Server Files

Эта папка - серверная часть плагина Lampa RUTUBE Proxy. Ее можно загрузить в корень сайта или в любой подкаталог, где работает PHP.

## Что загрузить

Минимальный набор для хостинга:

```text
rt.php
rt.js
proxy.php
stream.php
hls.php
index.php
status.php
```

`router.php` нужен только локальным запускателям из этого репозитория.

## Адрес для Lampa

Если файлы лежат в подкаталоге:

```text
https://your-domain.example/your-folder/rt.php
```

Если файлы лежат в корне сайта:

```text
https://your-domain.example/rt.php
```

## Проверка

Откройте в браузере:

```text
https://your-domain.example/your-folder/
https://your-domain.example/your-folder/rt.php
https://your-domain.example/your-folder/proxy.php?q=test
https://your-domain.example/your-folder/stream.php?id=test
```

Что должно быть:

- `/` показывает статусную страницу;
- `rt.php` показывает JavaScript-код;
- `proxy.php?q=test` возвращает JSON;
- `stream.php?id=test` возвращает JSON с `Invalid video id` и HTTP 400. Это нормально: `test` не настоящий RUTUBE id.

Если вместо этого открывается 404-страница сайта, значит PHP в этом каталоге не выполняется или основной конфиг сайта перехватывает путь.
