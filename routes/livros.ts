import { PrismaClient } from '@prisma/client'
import { Router } from 'express'
import { z } from 'zod'

const prisma = new PrismaClient()
const router = Router()

const GOOGLE_URL = "https://www.googleapis.com/books/v1/volumes"
const GOOGLE_KEY = process.env.GOOGLE_BOOKS_KEY 

const livroSchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório").max(60),
  dataLancamento: z.coerce.date(),
  foto: z.string(),
  descricao: z.string().max(200),
  genero: z.enum(["ACAO", "DRAMA", "FICCAO", "TERROR", "ROMANCE", "COMEDIA"]).optional(),
  autorNome: z.string(),
})

router.get("/", async (req, res) => {
  try {
    const livros = await prisma.livros.findMany({
      include: { autor: true },
    })
    res.status(200).json(livros)
  } catch (error) {
    res.status(500).json({ error: "Erro ao buscar livros", details: error })
  }
})

router.get("/:id", async (req, res) => {
  const id = Number(req.params.id)
  if (isNaN(id)) return res.status(400).json({ error: "ID inválido" })

  try {
    const livro = await prisma.livros.findUnique({
      where: { id },
      include: { autor: true },
    })
    if (!livro) return res.status(404).json({ error: "Livro não encontrado" })
    res.status(200).json(livro)
  } catch (error) {
    res.status(500).json({ error: "Erro ao buscar livro", details: error })
  }
})

router.post("/", async (req, res) => {
  const valida = livroSchema.safeParse(req.body)
  if (!valida.success) return res.status(400).json({ error: valida.error.flatten() })

  const { nome, dataLancamento, foto, descricao, genero = "ACAO", autorNome } = valida.data

  try {
    const autor = await prisma.autores.findFirst({ where: { nome: autorNome } })
    if (!autor) return res.status(400).json({ error: "Autor não encontrado" })

    const livro = await prisma.livros.create({
      data: {
        nome,
        dataLancamento,
        foto,
        descricao,
        genero,
        autor_id: autor.id,
      },
    })
    res.status(201).json(livro)
  } catch (error) {
    res.status(500).json({ error: "Erro ao criar livro", details: error })
  }
})

router.delete("/:id", async (req, res) => {
  const id = Number(req.params.id)
  if (isNaN(id)) return res.status(400).json({ error: "ID inválido" })

  try {
    const livro = await prisma.livros.delete({ where: { id } })
    res.status(200).json(livro)
  } catch (error) {
    res.status(404).json({ error: "Livro não encontrado", details: error })
  }
})

router.put("/:id", async (req, res) => {
  const id = Number(req.params.id)
  if (isNaN(id)) return res.status(400).json({ error: "ID inválido" })

  const valida = livroSchema.safeParse(req.body)
  if (!valida.success) return res.status(400).json({ error: valida.error.flatten() })

  const { nome, dataLancamento, foto, descricao, genero = "ACAO", autorNome } = valida.data

  try {
    const autor = await prisma.autores.findFirst({ where: { nome: autorNome } })
    if (!autor) return res.status(400).json({ error: "Autor não encontrado" })

    const livro = await prisma.livros.update({
      where: { id },
      data: {
        nome,
        dataLancamento,
        foto,
        descricao,
        genero,
        autor_id: autor.id,
      },
    })
    res.status(200).json(livro)
  } catch (error) {
    res.status(404).json({ error: "Livro não encontrado", details: error })
  }
})

router.get("/pesquisa/:termo", async (req, res) => {
  const termo = req.params.termo.trim()
  const termoNumero = Number(termo)

  try {
    let livros

    if (isNaN(termoNumero)) {
      livros = await prisma.livros.findMany({
        where: {
          OR: [
            { nome: { contains: termo, mode: "insensitive" } },
            { autor: { nome: { contains: termo, mode: "insensitive" } } },
          ],
        },
        include: { autor: true },
      })
    } else {
      livros = await prisma.livros.findMany({
        where: {
          dataLancamento: {
            gte: new Date(termoNumero, 0, 1),
            lt: new Date(termoNumero + 1, 0, 1),
          },
        },
        include: { autor: true },
      })
    }

    res.status(200).json(livros)
  } catch (error) {
    res.status(500).json({ error: "Erro na pesquisa", details: error })
  }
})

function formataLivroGoogle(item: any) {
  const info = item.volumeInfo ?? {}
  return {
    googleId: item.id as string,
    nome: (info.title ?? "Sem título").slice(0, 255),
    autor: info.authors?.[0] ?? null,
    dataLancamento: info.publishedDate ? new Date(info.publishedDate) : null,
    foto: (info.imageLinks?.thumbnail ?? "").replace("http://", "https://"),
    descricao: info.description ?? "",
    paginas: info.pageCount ?? null,
  }
}

router.get("/google/:termo", async (req, res) => {
  const params = new URLSearchParams({
    q: req.params.termo,
    maxResults: "20",
    printType: "books",
    langRestrict: "pt",
  })
  if (GOOGLE_KEY) params.set("key", GOOGLE_KEY)

  try {
    const resposta = await fetch(`${GOOGLE_URL}?${params}`)
    if (!resposta.ok) return res.status(502).json({ error: "Erro na Google Books" })
    const dados: any = await resposta.json()
    res.status(200).json((dados.items ?? []).map(formataLivroGoogle))
  } catch (error) {
    res.status(500).json({ error: "Erro ao buscar na Google Books", details: error })
  }
})

router.post("/importar/:googleId", async (req, res) => {
  const { googleId } = req.params

  try {
    const existente = await prisma.livros.findUnique({
      where: { googleId },
      include: { autor: true },
    })
    if (existente) return res.status(200).json(existente)

    const url = `${GOOGLE_URL}/${googleId}${GOOGLE_KEY ? `?key=${GOOGLE_KEY}` : ""}`
    const resposta = await fetch(url)
    if (!resposta.ok) return res.status(404).json({ error: "Livro não encontrado na Google" })

    const g = formataLivroGoogle(await resposta.json())

    let autorId: number | null = null
    if (g.autor) {
      const nomeAutor = g.autor.slice(0, 100)
      const autor =
        (await prisma.autores.findFirst({ where: { nome: nomeAutor } })) ??
        (await prisma.autores.create({ data: { nome: nomeAutor } }))
      autorId = autor.id
    }

    const livro = await prisma.livros.create({
      data: {
        googleId: g.googleId,
        nome: g.nome,
        dataLancamento: g.dataLancamento,
        foto: g.foto,
        descricao: g.descricao.replace(/<[^>]+>/g, ""),
        autor_id: autorId,
      },
      include: { autor: true },
    })
    res.status(201).json(livro)
  } catch (error) {
    res.status(500).json({ error: "Erro ao importar livro", details: error })
  }
})

export default router
