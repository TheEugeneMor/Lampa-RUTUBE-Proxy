# Lampa RUTUBE Proxy Server

Автор: Eugene Pchelnikov. Связь в Telegram: [@eugenemor](https://t.me/eugenemor).

Эта папка - серверная часть плагина. Ее можно положить в document root любой виртуалки/хостинга, где уже есть веб-сервер с PHP.

## Требования

- PHP 8.1+.
- Желательно расширения `curl` и `openssl`.
- Для Apache: включенные `mod_rewrite` и, желательно, `mod_headers`.
- Для nginx: настроенный PHP-FPM.

## URL для Lampa

После размещения папки добавьте в Lampa:

```text
https://your-domain.example/rt.js
```



## Apache

Для Apache уже есть `.htaccess`. Он делает:

- `/` -> `status.php`

## nginx

Для nginx есть готовый файл:

```text
nginx-lampa-rutube.conf
```

Скопируйте содержимое папки `server` в document root сайта и подключите конфиг внутри блока `server { ... }`:

```nginx
include /path/to/server/nginx-lampa-rutube.conf;
```

Внутри `nginx-lampa-rutube.conf` проверьте строку `fastcgi_pass`. Путь зависит от вашей системы и версии PHP.

## Проверка

Откройте:

```text
https://your-domain.example/
```

Страница должна показать адрес плагина. Потом проверьте:

```text
https://your-domain.example/proxy.php?q=test
```

Должен вернуться JSON с результатами RUTUBE.
