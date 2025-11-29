# GRUPO 06

Este es el repositorio del "Grupo 06", cuyos integrantes son:

* Montserrat Antunez - 202203018-6
* Axel Tapia - 202373080-7
* Maria-Belen Segura - 202203002-K
* Luka Caric - 202373034-3
* Georg Graesdal - 90005138-7
* **Tutor**: Paula Castillo 

## Wiki

Puede acceder a la wiki mediante el siguiente [enlace](https://gitlab.com/grupo-0006/GRUPO06-2025-PROYINF/-/wikis/home)

## Videos

* [Video presentación cliente](https://aula.usm.cl/pluginfile.php/7621199/mod_resource/content/2/video1352931478.mp4)
* [Video Prototipo proyecto](https://youtu.be/TjyuEVveL78)

## Aspectos técnicos relevantes

- Se incorporo una nueva Historias de Usuario en el repositorio:  
  - HU006: 
- Avannzamos el codigo en lo posible.
- Concluimos sobre nuestro proyecto en la wiki en la seccion de Resultados Finales.

## Para levantar el proyecto

* Paso 1: Descargar el archivo proyecto-base-main.zip y descomprimirlo.
* Paso 2: En la carpeta principal abrir una terminal y levantar los contenedores de MySQL y API_TRAMITACION con el siguiente comando:
```
docker compose up --build -d
```
* Paso 3: Verificar la instalación. En el navegador, buscar: http://localhost:8000

### Opcional
* Paso X: Para verificar si los contenedores están corriendo:
```
docker ps -a
```
Deben aparecer los dos contenedores.
* Paso X: Para ver las tablas de la base de datos de API_TRAMITACION:
```
docker exec -it proyecto-base-main-mysql-1 mysql -uroot -p
```
Donde "proyecto-base-mysql-1" es el nombre del contenedor. Si no coincide, revisarlo con "docker ps". Luego, ingresar la clave: **password**.
```
SHOW DATABASES;         // Mostrar bases de datos
USE BD06_TRAMITACION;   // Seleccionar base de datos
SHOW TABLES;            // Mostrar tablas de la base de datos seleccionada
```


