/**
 * Frase do dia: lista curada, escolhida de forma determinística pela data.
 * A mesma frase o dia inteiro; muda à meia-noite.
 */
export type Quote = { text: string; author: string };

export const QUOTES: Quote[] = [
  {
    text: "Ensina-nos a contar os nossos dias, para que alcancemos coração sábio.",
    author: "Salmo 90:12",
  },
  {
    text: "A maneira como você passa os seus dias é, no fim, a maneira como passa a sua vida.",
    author: "Annie Dillard",
  },
  { text: "Não é que tenhamos pouco tempo, é que perdemos muito dele.", author: "Sêneca" },
  {
    text: "Tudo o que temos de decidir é o que fazer com o tempo que nos é dado.",
    author: "J. R. R. Tolkien",
  },
  { text: "A pressa é a inimiga da vida espiritual em nossos dias.", author: "Dallas Willard" },
  { text: "Você não encontra tempo para o que importa. Você o reserva.", author: "Jordan Raynor" },
  {
    text: "Diga não a mil coisas boas para dizer sim às poucas essenciais.",
    author: "Greg McKeown",
  },
  {
    text: "Comece onde você está. Use o que você tem. Faça o que você pode.",
    author: "Arthur Ashe",
  },
  {
    text: "Disciplina é escolher entre o que você quer agora e o que você quer mais.",
    author: "Abraham Lincoln",
  },
  { text: "O que fazemos repetidamente é o que nos torna quem somos.", author: "Aristóteles" },
  {
    text: "Descansar não é preguiça; é a condição do trabalho que dura.",
    author: "John Mark Comer",
  },
  { text: "Concentre-se em ser produtivo, não em estar ocupado.", author: "Tim Ferriss" },
  { text: "Quem tem um porquê suporta quase qualquer como.", author: "Viktor Frankl" },
  { text: "Um dia bem vivido faz de todo ontem um sonho de felicidade.", author: "Kalidasa" },
  { text: "A qualidade da sua atenção determina a qualidade da sua vida.", author: "Cal Newport" },
  {
    text: "Faça uma coisa de cada vez, e faça-a como se nada mais existisse.",
    author: "Provérbio zen",
  },
  { text: "Amanhã é a desculpa preferida de quem nunca começa.", author: "Provérbio popular" },
  { text: "Não conte os dias; faça os dias contarem.", author: "Muhammad Ali" },
  {
    text: "Grandes coisas não são feitas por impulso, mas por uma série de pequenas coisas reunidas.",
    author: "Vincent van Gogh",
  },
  { text: "A simplicidade é o último grau de sofisticação.", author: "Leonardo da Vinci" },
  { text: "Se você quer mudar o mundo, comece arrumando a sua cama.", author: "William McRaven" },
  { text: "Paciência é também uma forma de ação.", author: "Auguste Rodin" },
  { text: "Aquilo a que você dá atenção cresce.", author: "Provérbio" },
  { text: "Trabalhe duro no silêncio; deixe o resultado fazer o barulho.", author: "Frank Ocean" },
  { text: "A perfeição é inimiga do feito.", author: "Voltaire" },
  {
    text: "Você nunca vai encontrar tempo para nada. Se quiser tempo, precisa criá-lo.",
    author: "Charles Buxton",
  },
  { text: "A vida é o que acontece enquanto você faz outros planos.", author: "John Lennon" },
  { text: "O segredo de seguir em frente é começar.", author: "Mark Twain" },
  { text: "Descanso não é o oposto do trabalho; é parte dele.", author: "Alex Soojung-Kim Pang" },
  {
    text: "Ser ocupado é uma forma de preguiça: pensar sem discernimento e agir sem critério.",
    author: "Tim Ferriss",
  },
  { text: "Não há vento favorável para quem não sabe aonde vai.", author: "Sêneca" },
  { text: "Cuide dos minutos e as horas cuidarão de si mesmas.", author: "Lord Chesterfield" },
  { text: "Consistência é mais rara do que talento.", author: "Provérbio" },
  { text: "Pequenos hábitos, repetidos, tornam-se destino.", author: "James Clear" },
  { text: "O tempo que você gosta de perder não é tempo perdido.", author: "Marthe Troly-Curtin" },
  { text: "Silêncio não é ausência de vida; é onde a vida se ouve.", author: "Thomas Merton" },
  { text: "A atenção é a forma mais rara e mais pura de generosidade.", author: "Simone Weil" },
  { text: "Não adianta correr; é preciso partir a tempo.", author: "Jean de La Fontaine" },
  { text: "O que é urgente raramente é importante.", author: "Dwight D. Eisenhower" },
  {
    text: "Só se vê bem com o coração; o essencial é invisível aos olhos.",
    author: "Antoine de Saint-Exupéry",
  },
  { text: "Comece com o fim em mente.", author: "Stephen Covey" },
  { text: "A vida é longa se você souber usá-la.", author: "Sêneca" },
  {
    text: "Faça hoje o que outros não fazem, para viver amanhã como outros não vivem.",
    author: "Jerry Rice",
  },
  { text: "Coragem é continuar depois que ninguém está olhando.", author: "Provérbio" },
  { text: "Você é responsável pelo esforço, não pelo resultado.", author: "Bhagavad Gita" },
  { text: "Uma tarefa por vez é a forma mais rápida de terminar tudo.", author: "Provérbio" },
  {
    text: "O melhor momento para plantar uma árvore foi há vinte anos. O segundo melhor é agora.",
    author: "Provérbio chinês",
  },
  { text: "Não deixe o bom impedir o ótimo, nem o ótimo impedir o feito.", author: "Provérbio" },
  { text: "Cansaço não é medalha.", author: "Provérbio" },
  {
    text: "Aprenda a dizer não; isso lhe será mais útil do que saber ler em latim.",
    author: "Charles Spurgeon",
  },
];

export const VERSES: Quote[] = [
  {
    text: "Ensina-nos a contar os nossos dias, para que alcancemos coração sábio.",
    author: "Salmo 90:12",
  },
  { text: "Entrega o teu caminho ao Senhor; confia nele, e ele tudo fará.", author: "Salmo 37:5" },
  {
    text: "Tudo tem o seu tempo determinado, e há tempo para todo propósito debaixo do céu.",
    author: "Eclesiastes 3:1",
  },
  {
    text: "Buscai primeiro o Reino de Deus, e todas essas coisas vos serão acrescentadas.",
    author: "Mateus 6:33",
  },
  { text: "O Senhor é o meu pastor; nada me faltará.", author: "Salmo 23:1" },
  {
    text: "Vinde a mim todos os que estais cansados e sobrecarregados, e eu vos aliviarei.",
    author: "Mateus 11:28",
  },
  {
    text: "Tudo o que fizerdes, fazei de todo o coração, como para o Senhor.",
    author: "Colossenses 3:23",
  },
  { text: "As misericórdias do Senhor se renovam a cada manhã.", author: "Lamentações 3:23" },
  { text: "Aquietai-vos e sabei que eu sou Deus.", author: "Salmo 46:10" },
  {
    text: "O coração do homem planeja o seu caminho, mas o Senhor lhe dirige os passos.",
    author: "Provérbios 16:9",
  },
  { text: "Não andeis ansiosos por coisa alguma.", author: "Filipenses 4:6" },
  {
    text: "Lâmpada para os meus pés é a tua palavra, e luz para o meu caminho.",
    author: "Salmo 119:105",
  },
  { text: "Portanto, vede prudentemente como andais, remindo o tempo.", author: "Efésios 5:15-16" },
  { text: "Melhor é o fim das coisas do que o seu princípio.", author: "Eclesiastes 7:8" },
  {
    text: "Este é o dia que o Senhor fez; regozijemo-nos e alegremo-nos nele.",
    author: "Salmo 118:24",
  },
  { text: "Os que esperam no Senhor renovam as suas forças.", author: "Isaías 40:31" },
  {
    text: "Em paz me deito e logo pego no sono, porque só tu, Senhor, me fazes repousar seguro.",
    author: "Salmo 4:8",
  },
  { text: "Seja o vosso sim, sim; e o vosso não, não.", author: "Tiago 5:12" },
  { text: "O Senhor lutará por vós; e vós vos calareis.", author: "Êxodo 14:14" },
  {
    text: "Confia no Senhor de todo o teu coração e não te apoies no teu próprio entendimento.",
    author: "Provérbios 3:5",
  },
];

/** Índice estável derivado da data (mesma frase o dia inteiro). */
function indexFor(dateISO: string, size: number) {
  let h = 0;
  for (let i = 0; i < dateISO.length; i++) h = (h * 31 + dateISO.charCodeAt(i)) % 100000;
  return h % size;
}

export function quoteOfTheDay(dateISO: string, spiritual = false): Quote {
  const lista = spiritual ? VERSES : QUOTES;
  return lista[indexFor(dateISO, lista.length)];
}
