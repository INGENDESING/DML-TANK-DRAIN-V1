Eres un ingeniero experto y vamos a desarrollar una aplicacion web HTML avanzada (front, nivel de maestria para el calculo del tiempo vaciado de tanques en regimen transitorio para tal fin  vamos a considerar el sistema de la siguiente manera:

1. El sistema consta de un tanque atmosferico de fondo torisferico con dimensiones de acuerdo a norma, despues del tanque hay una valvula de mariposa, despues un avance en longitud equivalente en tuberias y accesorios, y finalmente una bomba.

Para el sistema descrito en el numeral 1 requerimos que la aplicacion pida la siguientes informacion:

1. Diametro del tanque en m
2. Altura del tanque en m
3. Nivel del liquido del tanque en m desde la boquilla de descarga.
4. Porcentaje de ocupacion del tanque
5. Diametro salida del tanque en Pulgadas
6. Tipo de tuberia a la salida del tanque y diametro, BPE, ANSI, DIN
7. Tipo de valvula a la salida del tanque, BOLA, COMPUERTA , DIAFRAGMA, MARIPOSA, GLOBO, MIXPROOF
8. Acesorios en la tuberia, como reducciones, ampliaciones, codos, tees etc
9. Tipo de bomba, centrifuga, desplazamiento positivo
10. Altura de la boquilla salida del tanque a la succion de la bomba
11. Cinco puntos de operacion de la bomba Caudal (m3/h vs THD en bar)
12. Cinco puntos de operacion de la bomba Caudal (m3/h vs NSPH requerimo en mca)
13. Densidad del fluido
14. viscosidad del fluido
15. presion de vapor del fluido

Con la informacion anterior el objeto es poder determinar  :

* Dimensiones geometricas del tanque en cuanto a su diametro, altura, dimensiones del fondo torisferico, volumen total del tanque, volumen tanque vs altura del liquido hasta la boquilla de salida.
* Calculo de las caidas de presion en el tramo entre el tanque y la succion de la bomba , para lo cual se construira una base de datos para diametros de tuberia entre 1" y 24", en las normas BPE, ASME B31.1, DIN para materiales como acero inoxidable 316l, acero al carbon y tuberia plastica.
* Calculo de la caida de presion de acuerdo al flujo dinamico y la valvula seleccionada, construye una base de datos de las caracteristicas de estas valvulas para la caida de presion.
* Para la valvula queremos tener datos de el flujo y la diferencial de presion a las condiciones del fluido

En los resultados mostrados queremos ver :

1. Una grafica denominada  dinamica animada que llamaremos GA1 mostrando como se desocupa el tanque en el tiempo transcurrido , es esta grafica la medida de la presion a la succion de la bomba, la medida de la velocidad de la tuberia en m/s, en la grafica tambien visualizar en la valvula antes de la bomba el diferencial de presion, de la grafica aclaro la distribucion: El tanque con fondo y tapa torisferico donde se indica el nivel y el tiempo , sigue la boquilla indicando el diametro en pulgadas, sigue la tuberia vertical donde se diagrama la valvula donde se indica el diferencial de presion en bar y el flujo en m3/h, despues de la valvula sigue un codo a una tuberia vertical con un filtro, despues una reduccion excentrica y finalmente una bomba en donde se indica la presion a la succion, el flujo en m3/h,  HSPH disponible en mca y el NHPH requerido en mca. En esta grafica si el NSPH disponible es 1.2 veces mayor al requerido generar una alarma y parar el vaciado (paro de la bomba) diciendo el volumen final y su porcentaje de uso, es esta condicion la llamaremos nivel minimo. Para la valvula seleccionada (de la cual previamente tenemos una base de datos de caidas de presion) determinamos el valor de su Cv y tener la opcion en la grafica de cambiar el % de apertura, ESTOS VALORES DEBEN VERSA EN LA GRAFICA ANIMADA, y la introduccion del porcentaje de apertura debe poder introducirce como dato en la grafica animada y toso los valores relacionados deben variar en la grafica.
2. Una segunda grafica en donde se muestra El nivel del tanque en metros (eje y) vs el tiempo transcurrido en segundos y la linea del nivel minimo calculada en el numeral anterior.
3. Para la valvula seleccionada (de la cual previamente tenemos una base de datos de caidas de presion) determinamos el valor de su Cv , la caida de presion  y la condicion de choque, toda esta informacion en una tabla.
4. Finalmente debajo de la grafica una tabla con los tiempos desde el tiempo cero, el nivel del tanque en m, la velocidad en la tuberia, la caida de presion en la tuberia, la caidad de presion en la valvula, el cv de la valvula, la presion de succion en la tuberia en bara, el nsph disponible, el nsph requerido y la diferencia entre nsph disponible menos el nsph requerido.



Todos los cálculos en phyton usa todas las herramientas necesarias para construir la aplicación con cálculos phyton, graficas interactivas animaciones etc, eres un experto en programación de paginas web para cálculos de fluidos en ingeniería.









