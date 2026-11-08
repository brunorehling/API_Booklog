import { PrismaClient } from '@prisma/client'
import { Router } from 'express'
import { z } from 'zod'
import { buscarNaGoogle, garantirLivro } from '../services/googleBooks'

const prisma = new PrismaClient()
const router = Router()


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

// ---------- Google Books ----------

// GET /livros/google/:termo -> busca livros na Google (não salva nada)
router.get("/google/:termo", async (req, res) => {
  try {
    res.status(200).json(await buscarNaGoogle(req.params.termo))
  } catch (error) {
    res.status(502).json({ error: "Erro ao buscar na Google Books" })
  }
})

// POST /livros/importar/:googleId -> garante o livro no banco e devolve com id
router.post("/importar/:googleId", async (req, res) => {
  try {
    const livro = await garantirLivro(req.params.googleId)
    if (!livro) return res.status(404).json({ error: "Livro não encontrado na Google" })
    res.status(200).json(livro)
  } catch (error) {
    res.status(500).json({ error: "Erro ao importar livro", details: error })
  }
})

export default router
