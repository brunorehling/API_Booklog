import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const GOOGLE_URL = "https://www.googleapis.com/books/v1/volumes"

function comChave(url: string) {
  const key = process.env.GOOGLE_BOOKS_KEY
  if (!key) return url
  return url + (url.includes("?") ? "&" : "?") + `key=${key}`
}

// Converte o formato da Google para o formato usado no Booklog
export function formataLivroGoogle(item: any) {
  const info = item.volumeInfo ?? {}
  return {
    googleId: item.id as string,
    nome: (info.title ?? "Sem título").slice(0, 225),
    autor: (info.authors?.[0] as string | undefined) ?? null,
    dataLancamento: info.publishedDate ? new Date(info.publishedDate) : null,
    foto: (info.imageLinks?.thumbnail ?? "").replace("http://", "https://"),
    descricao: (info.description ?? "").replace(/<[^>]+>/g, ""), // a Google manda HTML
    paginas: (info.pageCount as number | undefined) ?? null,
  }
}

export async function buscarNaGoogle(termo: string) {
  const params = new URLSearchParams({
    q: termo,
    maxResults: "20",
    printType: "books",
    langRestrict: "pt",
  })
  const resposta = await fetch(comChave(`${GOOGLE_URL}?${params}`))
  if (!resposta.ok) throw new Error(`Google Books respondeu ${resposta.status}`)
  const dados: any = await resposta.json()
  return (dados.items ?? []).map(formataLivroGoogle)
}

// Garante que o livro existe no banco (guarda só os dados básicos vindos da Google)
// e devolve o registro. Se já foi salvo antes, só devolve.
export async function garantirLivro(googleId: string) {
  const existente = await prisma.livros.findUnique({
    where: { googleId },
    include: { autor: true },
  })
  if (existente) return existente

  const resposta = await fetch(comChave(`${GOOGLE_URL}/${encodeURIComponent(googleId)}`))
  if (!resposta.ok) return null

  const g = formataLivroGoogle(await resposta.json())

  let autorId: number | null = null
  if (g.autor) {
    const nomeAutor = g.autor.slice(0, 100)
    const autor =
      (await prisma.autores.findFirst({ where: { nome: nomeAutor } })) ??
      (await prisma.autores.create({ data: { nome: nomeAutor } }))
    autorId = autor.id
  }

  return prisma.livros.create({
    data: {
      googleId: g.googleId,
      nome: g.nome,
      dataLancamento: g.dataLancamento,
      foto: g.foto,
      descricao: g.descricao,
      autor_id: autorId,
    },
    include: { autor: true },
  })
}
