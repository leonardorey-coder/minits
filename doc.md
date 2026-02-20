UNIVERSIDAD POLITÉCNICA

DE QUINTANA ROO

**Manual del diseño de tu lenguaje**

**P R E S E N T A**

ACTIVIDAD

**MATERIA**

COMPILADORES

CRUZ FLORES JUAN LEONARDO

**PROFESOR DE LA ASIGNATURA**

MOISÉS ORTEGA ZETINA

**UPQROO, Cancún, Q.ROO, 2026.**

# Tabla de contenido {#tabla-de-contenido .TOC-Heading}

[Documentación del Lenguaje MiniTS
[2](#documentación-del-lenguaje-minits)](#documentación-del-lenguaje-minits)

[Introducción [2](#introducción)](#introducción)

[Estructura general del programa
[2](#estructura-general-del-programa)](#estructura-general-del-programa)

[Tipos de datos [2](#tipos-de-datos)](#tipos-de-datos)

[Declaración de variables
[3](#declaración-de-variables)](#declaración-de-variables)

[Fin de línea [3](#fin-de-línea)](#fin-de-línea)

[Entrada y salida de datos
[3](#entrada-y-salida-de-datos)](#entrada-y-salida-de-datos)

[Lectura de datos [3](#lectura-de-datos)](#lectura-de-datos)

[Escritura de datos [3](#escritura-de-datos)](#escritura-de-datos)

[Asignación [3](#asignación)](#asignación)

[Estructuras condicionales
[3](#estructuras-condicionales)](#estructuras-condicionales)

[If / Else [3](#if-else)](#if-else)

[Estructuras repetitivas
[4](#estructuras-repetitivas)](#estructuras-repetitivas)

[While [4](#while)](#while)

[For [4](#for)](#for)

[Ejemplo completo de programa en MiniTS
[4](#ejemplo-completo-de-programa-en-minits)](#ejemplo-completo-de-programa-en-minits)

[Conclusión [4](#conclusión)](#conclusión)

#  Documentación del Lenguaje MiniTS

## Introducción

MiniTS es un lenguaje de programación educativo inspirado en TypeScript.
Su objetivo es facilitar el aprendizaje de los conceptos básicos de
programación estructurada y tipada, manteniendo una sintaxis clara y
cercana a lenguajes modernos.

MiniTS incluye:

- Tipado explícito

- Estructura clara de programa

- Control de flujo

- Entrada y salida de datos

## Estructura general del programa

Todo programa en MiniTS debe seguir la siguiente estructura:

program inicio

vars {

// declaración de variables

}

main {

// instrucciones

}

program fin

## Tipos de datos

MiniTS soporta los siguientes tipos de datos primitivos:

  -----------------------------------------------
  Tipo       Descripción               Ejemplo
  ---------- ------------------------- ----------
  number     Números enteros o         10, 3.5
             decimales                 

  string     Cadenas de texto          "Hola"

  boolean    Valores lógicos           true,
                                       false
  -----------------------------------------------

## Declaración de variables

Las variables se declaran dentro del bloque vars utilizando la palabra
clave let.

let edad: number;

let nombre: string;

let activo: boolean;

## Fin de línea

Todas las instrucciones deben finalizar con punto y coma ;.

x = 5;

## Entrada y salida de datos

### Lectura de datos

Se utiliza la instrucción read para leer datos del usuario.

read(nombre);

### Escritura de datos

Se utiliza la instrucción print para mostrar información en pantalla.

print(nombre);

## Asignación

La asignación de valores se realiza mediante el operador =.

x = 10;

## Estructuras condicionales

### If / Else

Permite ejecutar bloques de código dependiendo de una condición.

if (x \> 5) {

print(\"Mayor a 5\");

} else {

print(\"Menor o igual a 5\");

}

## Estructuras repetitivas

### While

Ejecuta un bloque de instrucciones mientras la condición sea verdadera.

while (x \< 10) {

x = x + 1;

}

### For

Permite repetir un bloque de código un número determinado de veces.

for (let i: number = 0; i \< 5; i = i + 1) {

print(i);

}

## Ejemplo completo de programa en MiniTS

program inicio

vars {

let x: number;

let nombre: string;

}

main {

read(nombre);

x = 0;

while (x \< 3) {

print(nombre);

x = x + 1;

}

}

program fin

## Conclusión

MiniTS es un lenguaje sencillo, estructurado y tipado que toma como
referencia a TypeScript, ideal para fines educativos y para comprender
los fundamentos de la programación.
