# DESIGN — Procure Aonde

## Direção visual

Criar uma interface inspirada na referência visual enviada, seguindo um estilo
moderno, minimalista e profissional.

O resultado deve preservar uma aparência elegante, organizada e intuitiva,
adaptada às funcionalidades do Procure Aonde. Evitar excesso de cores, bordas
pesadas, elementos desnecessários e aparência de painel administrativo.

## Características visuais

- Cabeçalho branco, compacto e organizado, com logo à esquerda, pesquisa
  centralizada e opções de acesso à direita.
- Banner principal grande, com gradiente azul e roxo, título centralizado em
  destaque e subtítulo.
- Barra de pesquisa ampla, branca, arredondada e com botão de pesquisa azul.
- Seção de categorias com cartões brancos, cantos arredondados, sombras suaves
  e ícones centralizados.
- Fundo geral em tons muito claros, com bastante espaço entre os elementos.
- Tipografia moderna, limpa e de fácil leitura.
- Botões arredondados e elementos com aparência leve.
- Layout responsivo para computadores, tablets e celulares.

## Paleta visual

| Uso | Cor |
| --- | --- |
| Azul principal | `#4165E8` |
| Roxo | `#8736E8` |
| Branco | `#FFFFFF` |
| Fundo | `#F7F8FC` |
| Texto principal | `#202124` |
| Cinza secundário | `#9297A3` |

## Estrutura da interface

### Cabeçalho

O cabeçalho deve ter fundo branco e altura compacta. Organizar os elementos
horizontalmente:

- logo “Procure Aonde” à esquerda;
- campo de pesquisa centralizado;
- opções de login e cadastro à direita;
- versão adaptada para telas menores, com menu recolhível quando necessário.

O cabeçalho deve utilizar espaçamento consistente, tipografia legível e
elementos alinhados verticalmente.

### Banner principal

Utilizar um banner de destaque com gradiente da cor azul `#4165E8` para a cor
roxa `#8736E8`.

O banner deve conter:

- título grande e centralizado;
- subtítulo curto explicando a proposta da plataforma;
- campo de pesquisa principal;
- campo para informar o serviço ou empresa;
- campo para localização;
- botão de pesquisa em azul;
- contraste suficiente entre texto, campos e plano de fundo.

O campo de pesquisa deve ser branco, amplo, arredondado e visualmente destacado,
com ícones simples e textos de orientação em português.

### Seção de categorias

Apresentar uma seção clara para navegação por categorias de serviços. Os itens
devem ser exibidos em cartões brancos com:

- cantos arredondados;
- sombras suaves;
- ícone centralizado;
- nome da categoria;
- área de clique confortável;
- efeito visual discreto ao passar o mouse ou focar pelo teclado.

Exemplos de categorias:

- Alimentação;
- Beleza e estética;
- Saúde;
- Manutenção;
- Transporte;
- Eventos;
- Educação;
- Lojas;
- Serviços profissionais.

### Cards de empresas

Os cards de empresas devem seguir a mesma linguagem visual das categorias:

- fundo branco;
- bordas arredondadas;
- sombra sutil;
- imagem ou logo da empresa;
- nome e categoria;
- localização resumida;
- quantidade de interações;
- botões arredondados para WhatsApp, Instagram, localização e pedido.

Os botões devem utilizar ícones reconhecíveis, texto alternativo e estados
visuais de hover, foco, carregamento e indisponibilidade.

### Barra lateral de serviços

Manter a barra lateral inicialmente recolhida e acessível por um botão com o
texto “Serviços” ou por um ícone de menu.

Ao abrir, a barra lateral deve:

- exibir as categorias de serviços;
- permitir selecionar uma categoria;
- preservar os filtros já aplicados;
- fechar por botão, clique fora do painel ou tecla `Esc`;
- possuir fundo branco e sombra suave;
- manter boa usabilidade em celulares.

## Tipografia

Utilizar uma família tipográfica moderna, limpa e de fácil leitura. A hierarquia
visual deve ser clara:

- títulos grandes e de alto contraste no banner;
- subtítulos com peso e tamanho intermediários;
- textos de apoio em cinza secundário;
- nomes de categorias e empresas com destaque suficiente;
- labels e mensagens de erro sempre visíveis e compreensíveis.

Evitar excesso de pesos, estilos decorativos e textos longos em áreas de
destaque.

## Botões e interações

- Utilizar botões arredondados e com aparência leve.
- Priorizar o azul `#4165E8` para ações principais.
- Utilizar o roxo `#8736E8` como cor complementar e de destaque.
- Garantir contraste adequado entre texto e fundo.
- Exibir estados de hover, foco, pressionado, carregamento e desabilitado.
- Não depender apenas de cor para comunicar estado ou erro.
- Manter áreas de toque confortáveis em dispositivos móveis.

## Espaçamento e composição

- Utilizar bastante espaço em branco entre as seções.
- Manter o conteúdo principal centralizado e com largura máxima confortável.
- Aplicar uma escala consistente de espaçamentos.
- Evitar excesso de elementos na mesma linha.
- Organizar os conteúdos em blocos facilmente escaneáveis.
- Usar o fundo `#F7F8FC` nas áreas gerais e branco nos componentes destacados.

## Responsividade

O layout deve funcionar corretamente em computadores, tablets e celulares.

### Computadores

- Cabeçalho com logo, pesquisa e opções de acesso na mesma linha.
- Banner amplo com pesquisa horizontal.
- Categorias distribuídas em uma grade de vários itens.
- Cards de empresas organizados em colunas.

### Tablets

- Reduzir espaçamentos e largura dos elementos sem perder legibilidade.
- Permitir que a pesquisa ocupe uma linha própria quando necessário.
- Ajustar a quantidade de colunas da grade de categorias e empresas.

### Celulares

- Utilizar cabeçalho compacto com menu recolhível.
- Empilhar os campos da pesquisa principal.
- Exibir categorias em uma ou duas colunas, conforme a largura disponível.
- Usar cards de empresas em uma única coluna.
- Garantir que a barra lateral ocupe somente a largura necessária e não esconda
  o conteúdo sem uma ação explícita.
- Manter botões de contato acessíveis e fáceis de tocar.

## Acessibilidade

- Garantir navegação completa por teclado.
- Exibir foco visível em links, botões, campos e cartões interativos.
- Associar labels aos campos de formulário.
- Usar textos alternativos para logos, imagens e ícones informativos.
- Manter contraste adequado entre textos e fundos.
- Comunicar estados de erro, sucesso e carregamento de forma textual.
- Usar semântica HTML adequada e não depender exclusivamente de ícones.

## Diretriz final

A identidade visual deve comunicar descoberta, proximidade, confiança e
facilidade de uso. Todas as telas, incluindo a área administrativa, devem
reutilizar a paleta, os espaçamentos, os cantos arredondados, as sombras suaves
e a tipografia definidos neste documento, sem transformar a experiência pública
em um painel administrativo.