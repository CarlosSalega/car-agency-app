# Arreglar el radio real y el espaciado colapsado del sidebar

## Objetivo

Hacer que los items del sidebar se vean efectivamente redondeados, y que al colapsar el sidebar los items no se peguen al borde derecho.

## Por qué

Dos defectos distintos, reportados por el usuario con capturas de DevTools. **Ninguno de los dos es la clase `rounded-*`**, que es lo que se venía ajustando a ciegas en intentos anteriores.

### Defecto 1 — `--radius:0` anula todos los radios del sidebar

`src/components/ui/sidebar.tsx:254` monta el `sidebar-inner` con `[--radius:0]`. Esa variable CSS **cascada a todos los descendientes**, y `src/app/globals.css:257` define la escala como:

```css
--radius-md: calc(var(--radius) - 2px);
```

Con `--radius: 0`, `rounded-md` computa `calc(0px - 2px)` = `-2px`, que es inválido en `border-radius`, así que la declaración se descarta y el radio queda en `0px`.

**Consecuencia:** las clases `rounded-*` aparecen aplicadas en DevTools y no producen nada. Cambiar `rounded-sm` por `rounded-md` o `rounded-lg` no puede mover el resultado: la variable que las genera está en cero. La clase `rounded-md` de `sidebarMenuButtonVariants` **ya estaba correcta**; lo que la anulaba es la variable.

Procedencia: `git log -L 254,254` lo atribuye a `cd878c0 feat(ui): add the sidebar block composed on Base UI primitives`. El valor veio con el bloque original y nunca se reviso.

### Defecto 2 — un boton de 32px dentro de una caja de 16px al colapsar

| Dato                        | Valor                                        | Origen            |
| --------------------------- | -------------------------------------------- | ----------------- |
| Ancho del sidebar colapsado | `SIDEBAR_WIDTH_ICON = "3rem"` = **48px**     | `sidebar.tsx:56`  |
| Padding de `SidebarGroup`   | `px-4` = 16px por lado -> contenido **16px** | `sidebar.tsx:363` |
| Ancho del boton colapsado   | `size-8!` = **32px**                         | `sidebar.tsx:414` |

El boton desborda 16px a la derecha y lo recorta el borde del contenedor, que es el sintoma reportado. Ademas el boton es `flex items-center` **sin** `justify-center`, asi que los 32px se alinean al inicio de una caja de 16px, se empujan a la derecha y el icono queda corrido del centro.

## Alcance autorizado

Tres cambios, todos en `src/components/ui/sidebar.tsx`. Ningun otro archivo.

1. **`sidebar.tsx:254`** — eliminar `[--radius:0]` de `sidebar-inner`.
2. **`sidebar.tsx:363`** — anadir `group-data-[collapsible=icon]:px-2` a `SidebarGroup`.
3. **`sidebar.tsx:414`** — anadir `group-data-[collapsible=icon]:justify-center` a `sidebarMenuButtonVariants`.
4. **`sidebar.tsx:414`** — anadir `group-data-[collapsible=icon]:gap-0` a `sidebarMenuButtonVariants`.

### Correccion de iteracion 2: el `gap-2` descentraba el icono 4px

`justify-center` solo no centro el icono. El usuario reporto que seguian descentrados, y la razon es que **el `gap-2` no se comprime cuando el label desaparece**.

El label `<span>` se oculta sin `hidden`: `truncate` aplica `overflow: hidden`, y eso hace que su `min-width: auto` resuelva a **0** en vez del ancho del texto, asi que flex lo comprime a 0px. Ese es el mecanismo real del ocultamiento, y por eso nunca hacia falta un `hidden` explicito. El `gap-2` (8px), en cambio, sigue midiendo 8px.

| Elemento                    | Ancho                          |
| --------------------------- | ------------------------------ |
| Caja de contenido del boton | 32px - 16px (`p-2`) = **16px** |
| Icono `[&_svg]:size-4`      | 16px                           |
| `gap-2`                     | **8px** <- no se comprime      |
| `span` del label            | 0px (comprimido por flex)      |
| **Contenido total**         | **24px** en una caja de 16px   |

Con `justify-center`, el offset es `(16 - 24) / 2 = -4px`. Centro del icono en 20px contra un centro de rail de 24px: **desvio de 4px**, poco visible pero suficiente para notarse.

Con `gap-0` colapsado el contenido son 16px en una caja de 16px y el icono cae en el centro geometrico sin depender de `justify-center`.

**Leccion transferible:** al centrar un item en un contenedor, el centro no esta-determinado por el item visible sino por **todo el contenido en flujo**, incluidos los gaps y los items colapsados a 0. Corregir el `justify` sin revisar que mas ocupa la fila produce un desvio pequeno y dificil de explicar. La pregunta util no es "esta centrado el item" sino "que suma el ancho total de la fila frente al ancho de la caja".

### Nota de alcance: por que el fix va en la clase base y no en `admin-sidebar.tsx`

El label vive en `admin-sidebar.tsx:218` (`<span>{item.label}</span>`), pero el comportamiento colapsado es propiedad de `sidebarMenuButtonVariants`, asi que el fix corresponde a la clase base y beneficia a todo consumidor futuro.

Se descarto aplicar `hidden` al `span` del label: el otro consumidor de `SidebarMenuButton` (`admin-sidebar.tsx:82-99`, el trigger del menu de usuario) tiene como ultimo hijo un `<ChevronsUpDown>` que es un `svg`, no un `span`, asi que la regla `[&>span:last-child]` no lo alcanza. La regla existente `truncate` ya cubre solo a los items de navegacion, que es exactamente el alcance buscado, y el avatar del footer mantiene su comportamiento actual sin tocar.

### Correccion de iteracion: `px-0` fue un sobrecorrido

La primera version de este arreglo uso `px-0` en el punto 2. **Estaba mal y el usuario lo reporto de inmediato: al colapsar los items se pegaron a la izquierda.**

El error fue tratar el padding como el problema cuando el problema era la _caja_:

| Padding colapsado | Caja de contenido | Boton | Resultado                                      |
| ----------------- | ----------------- | ----- | ---------------------------------------------- |
| `px-4` (16px)     | 16px              | 32px  | desborda 16px a la derecha, lo recorta el rail |
| `px-0` (0px)      | 48px              | 32px  | boton al inicio, 16px muertos a la derecha     |
| **`px-2` (8px)**  | **32px**          | 32px  | caja igual al boton, centrado                  |

La respuesta es `(48 - 32) / 2 = 8px` por lado, no cero. **Un padding colapsado correcto hace que la caja de contenido mida exactamente el ancho del boton; esa igualdad es lo que lo centra.** Ni `px-0` ni `px-4` la producen.

Ademas `justify-center` en el boton no centraba el boton: centra el icono dentro de los 32px. Son dos niveles distintos: el padding centra la caja, el `justify-center` centra el contenido dentro de la caja. Se necesitan ambos, y por eso el segundo arreglo los deja.

**Leccion transferible:** cuando un ajuste empuja el problema de un lado al otro, la pregunta correcta no es "cuanto padding le quito" sino "que valor hace que las dos medidas coincidan".

## Riesgo aceptado

Quitar `[--radius:0]` no solo afecta a los botones de navegacion: **todo** lo redondeado dentro del sidebar va a redondearse de golpe. Es el comportamiento correcto, pero el alcance real es mayor que el de los tres items de navegacion. Si algun elemento se vea rectangular a proposito, aparece aqui como seguimiento.

## Criterios de aceptacion

- [x] `rounded-md` produce un radio visible en `SidebarMenuButton`. **CONFIRMADO por el usuario** en navegador, tras la primera tanda.
- [x] Al colapsar, ningun item toca el borde derecho del sidebar. **CONFIRMADO por el usuario** en navegador.
- [x] Al colapsar, el icono queda centrado en su caja de 32px. **CONFIRMADO por el usuario** en navegador. El `gap-0` de `e72d53c` era aritmetica derivada; quedo confirmado por captura.
- [x] Al colapsar, el boton del footer muestra el avatar centrado y sin la astilla de la flecha. **CONFIRMADO por el usuario** en navegador, tras `d78e508`.
- [x] Ningun otro layout del sidebar se desplaza respecto al estado actual. **CONFIRMADO por el usuario** en navegador.
- [x] En mobile, tocar un item de navegacion cierra el sheet. **CONFIRMADO por el usuario**, y cubierto por tests (`444c0bf`).

## Checks

- [x] `pnpm exec tsc --noEmit` -> exit 0.
- [x] `pnpm exec prettier --check src/components/ui/sidebar.tsx` -> `All matched files use Prettier code style!`
- [x] `pnpm exec eslint src/components/ui/sidebar.tsx` -> sin salida, 0 problemas.
- [x] Barrido de residuos: `grep -- "--radius:0"` sobre `src/` no encuentra ningun otro reset. Los dos `--radius: 0.5rem` de `globals.css:104,188` son los legítimos (tema claro y oscuro). No queda ningun ancestro que vuelva a anular el radio.
- [x] **Confirmacion visual del `gap-0`, del footer y del sheet mobile.** Cerrado por el usuario en navegador tras `e72d53c`, `d78e508` y `1ebb9ae`.

## Que se puede y que no se puede verificar aca

Este repo **no tiene motor de layout**: jsdom no calcula radio, centrado, padding ni desbordamiento. Un test verde no prueba los pixeles, y esa confusion ya costo una iteracion entera en este mismo trabajo.

La division real del trabajo:

| Que                                      | Como se verifica                                                                                               |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Radio, centrado, padding, desbordamiento | **Solo** por captura del navegador. Aritmetica derivada del codigo como hipotesis, no como prueba.             |
| El sheet mobile cierra al tocar          | **Con test automatizado.** El estado del sheet es comportamiento, hay DOM para assertar, y no requiere layout. |

`444c0bf` es el ejemplo de por que conviene separar las dos cosas: cuando el defecto es de comportamiento, un test de verdad es mejor que pedirle al usuario que mire. Cuando el defecto es de geometria, ni el test ni el agente pueden probarlo, y decirlo con honestidad es parte del trabajo.

## Estado

**Commiteado y pusheado. `main` y `origin/main` en `8434564`. Working tree limpio, 0 stashes.**

Cuatro correcciones, todas verificadas por el usuario en navegador:

| Commit    | Cambio                                                          | Verificacion        |
| --------- | --------------------------------------------------------------- | ------------------- |
| `bfa8bac` | Quita `[--radius:0]`, colapsa a `px-2`, agrega `justify-center` | captura del usuario |
| `e72d53c` | Agrega `group-data-[collapsible=icon]:gap-0`                    | captura del usuario |
| `d78e508` | `p-0!` y `hidden` en el boton del footer                        | captura del usuario |
| `1ebb9ae` | Cierra el sheet mobile al tocar un item de navegacion           | test automatizado   |

**Este trabajo esta cerrado.** El `gap-0` era aritmetica derivada (16px de contenido en una caja de 16px) y quedo confirmado por captura; el footer quedo confirmado por captura; el sheet mobile quedo cubierto por tests. No queda nada abierto de este doc.

## Iteracion 3 — el boton del footer no cerraba

`e72d53c` arreglo los items de navegacion. El trigger del menu de usuario, en
`SidebarFooter`, es el otro consumidor de `SidebarMenuButton` y seguia roto: el avatar
quedaba pegado al borde izquierdo y el `ChevronsUpDown` se veia como una astilla al
borde derecho.

### Por que los fixes anteriores no lo alcanzaban

Los tres fixes viven en `sidebarMenuButtonVariants` y en `SidebarGroup`. El footer no
usa `SidebarGroup` — usa `SidebarFooter`, que tiene su propio `p-2` — y su boton tiene
dos hijos de ancho fijo que los items de navegacion no tienen.

La aritmetica, con el rail colapsado en 48px:

| Elemento                               | Ancho                            |
| -------------------------------------- | -------------------------------- |
| `SidebarFooter` `p-2`                  | 48 - 16 = **32px** de caja       |
| Boton `size-8!`                        | **32px**                         |
| Boton `p-2!`                           | 32 - 16 = **16px** de caja       |
| Avatar `<span>` `size-8` `shrink-0`    | **32px**, fijo                   |
| `<span>` del label                     | **0px** (lo comprime `truncate`) |
| `<ChevronsUpDown>` `size-4` `shrink-0` | **16px**, fijo                   |
| **Total**                              | **48px** en una caja de 16px     |

48px de contenido en 16px de caja. El avatar se come la caja entera desde la
izquierda y el chevron queda fuera, asomando lo que da el `overflow-hidden`. Eso es
exactamente la captura.

El contraste con los items de navegacion es la leccion: alla el unico hijo de ancho
fijo es el icono de 16px, y 16px en una caja de 16px es exacto. **La misma clase base
funciona con un hijo fijo de 16px y se rompe con uno de 32px.** El rail y el boton no
son el problema; la caja de 16px es la que se armó para el caso de los items.

### El fix

Dos cambios, ambos locales a `src/components/admin/admin-sidebar.tsx`, ninguno en la
clase base — cambiar `p-2!` a `p-0!` en la base realinearia los items de navegacion
tambien, y eso requiere su propia confirmacion visual.

1. `group-data-[collapsible=icon]:p-0!` en el `SidebarMenuButton` del footer: deja la
   caja de contenido en 32px, que es exactamente el avatar. Misma logica del punto 2
   del fix original: no se busca "cuanto padding sobra" sino "que valor hace que las
   dos medidas coincidan".
2. `group-data-[collapsible=icon]:hidden` en el `ChevronsUpDown`. La regla
   `[&>span:last-child]` que colapsa el label no lo alcanza porque este hijo es un
   `svg`, no un `span` — ya habia sido anotado en la nota de alcance del primer fix y
   sigue siendo la razon de que el footer quedara fuera.

Con el chevron oculto y la caja en 32px, el contenido es 32px en 32px.

### Pendiente de verificacion

**`tsc` exit 0, 70/70 tests, eslint y prettier limpios, y nada de eso prueba los
pixeles.** Este repo no tiene motor de layout: jsdom no calcula ancho, padding ni
desbordamiento. Los tres numeros de la tabla de arriba son aritmetica derivada del
codigo, igual que el `gap-0` de `e72d53c`. La unica prueba real es abrir `/admin`,
colapsar el sidebar y mirar el boton del footer. Si el avatar sigue corrido, el
`Computed` de ese boton con `width`, `padding` y los `width` de sus hijos cierra el
caso en una iteracion.

## Rollback

- Radio y padding: `git revert bfa8bac`
- Centrado del icono: `git revert e72d53c`
- Boton del footer: `git revert <sha de esta iteracion>`
- Sin perder historial: `git checkout 1fa11ec -- src/components/ui/sidebar.tsx`
