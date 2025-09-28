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

## Aspectos técnicos relevantes

- Se creó el Milestone **Hito 2** para organizar las entregas.  
- Se incorporaron tres Historias de Usuario como Issues en el repositorio:  
  - HU001: Simulación de crédito  
  - HU002: Solicitud de crédito  
  - HU003: Evaluación de riesgo  
- Cada HU está asociada al Milestone **Hito 2** y etiquetada con el Label **En proceso**.  
- Se configuró un tablero Kanban (**Issue Board - Hito 2**) con los estados de las HU.  
- Se documentaron las Historias de Usuario en la Wiki con enlaces directos a cada Issue. 
- Se añadieron los **Diagramas de Secuencia** de cada HU en la Wiki para representar gráficamente la interacción entre actores, interfaces y entidades del sistema.  

## Para levantar el proyecto

* Paso 1: Descargar el archivo proyecto-base-main.zip y descomprimirlo.
* Paso 2: En la carpeta principal abrir una terminal levantar MySQL con el siguiente comando:
```
docker compose up --build
```
* Paso 3: Una vez listo, crear las bases de datos con el comando:
```
docker exec -it proyecto-base-mysql-1 mysql -uroot -p
```
Donde "proyecto-base-mysql-1" es el nombre del contenedor. Si no coincide, revisarlo con "docker ps". Luego, ingresar la clave: **password**.
```
CREATE DATABASE BD06_TRAMITACION;
CREATE DATABASE BD06_VALIDACIONES;
EXIT;
```
* Paso 4: Levantar API, dirigiéndose a la ruta de la carpeta API_TRAMITACION:
```
cd API_TRAMITACION
docker compose up --build -d
cd ..
```
* Paso 5: Verificar la instalación. En el navegador, buscar: http://localhost:8080/