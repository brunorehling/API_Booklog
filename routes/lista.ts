import { PrismaClient } from '@prisma/client'
import { Router } from 'express'
import { z } from 'zod'
import { verificaUsuario } from '../middlewares/verificaUsuario'
import { garantirLivro } from '../services/googleBooks'

const prisma = new PrismaClient()
const router = Router()

// Todas as rotas da lista exigem usuário logado
router.use(verificaUsuario)

const statusSchema = z.enum(["QUERO_LER", "LENDO", "LIDO"])

const adicionarSchema = z.object({
  googleId: z.string().min(1, "googleId é obrigatório"),
  status: statusSchema.optional(),
})

const reviewSchema = z.object({
  titulo: z.string().min(1, "Título é obrigatório"),
  conteudo: z.string().max(1000).optional(),
  nota: z.number().int().min(1, "A nota deve ser no mínimo 1").max(5, "A nota deve ser no máximo 5"),
})

// Busca um item garantindo que pertence ao usuário logado
async function itemDoUsuario(id: number, usuarioId: number) {
  if (isNaN(id)) return null
  return prisma.listaLeitura.findFirst({ where: { id, usuarioId } })
}

// GET /lista?status=QUERO_LER  -> livros da lista do usuário (filtro opcional)
// Cada item vem com "review" preenchida se o usuário já avaliou aquele livro
router.get("/", async (req, res) => {
  const usuarioId = req.usuarioId!
  const status = statusSchema.safeParse(req.query.status)

  try {
    const itens = await prisma.listaLeitura.findMany({
      where: { usuarioId, ...(status.success && { status: status.data }) },
      include: { livro: { include: { autor: true } } },
      orderBy: { updatedAt: "desc" },
    })

    const reviews = await prisma.review.findMany({
      where: { usuarioId, livros_id: { in: itens.map((i) => i.livroId) } },
    })

    res.status(200).json(
      itens.map((item) => ({
        ...item,
        review: reviews.find((r) => r.livros_id === item.livroId) ?? null,
      }))
    )
  } catch (error) {
    res.status(500).json({ error: "Erro ao buscar sua lista", details: error })
  }
})

// POST /lista  { googleId, status? } -> adiciona um livro da Google na lista
router.post("/", async (req, res) => {
  const usuarioId = req.usuarioId!
  const valida = adicionarSchema.safeParse(req.body)
  if (!valida.success) return res.status(400).json({ error: valida.error.flatten() })

  try {
    const livro = await garantirLivro(valida.data.googleId)
    if (!livro) return res.status(404).json({ error: "Livro não encontrado na Google" })

    const jaExiste = await prisma.listaLeitura.findUnique({
      where: { usuarioId_livroId: { usuarioId, livroId: livro.id } },
    })
    if (jaExiste) return res.status(409).json({ error: "Esse livro já está na sua lista" })

    const item = await prisma.listaLeitura.create({
      data: { usuarioId, livroId: livro.id, status: valida.data.status },
      include: { livro: { include: { autor: true } } },
    })
    res.status(201).json({ ...item, review: null })
  } catch (error) {
    res.status(500).json({ error: "Erro ao adicionar na lista", details: error })
  }
})

// PATCH /lista/:id  { status } -> muda o status (ex.: marcar como LIDO)
router.patch("/:id", async (req, res) => {
  const usuarioId = req.usuarioId!
  const valida = z.object({ status: statusSchema }).safeParse(req.body)
  if (!valida.success) return res.status(400).json({ error: valida.error.flatten() })

  try {
    const item = await itemDoUsuario(Number(req.params.id), usuarioId)
    if (!item) return res.status(404).json({ error: "Item não encontrado na sua lista" })

    const atualizado = await prisma.listaLeitura.update({
      where: { id: item.id },
      data: { status: valida.data.status },
      include: { livro: { include: { autor: true } } },
    })
    res.status(200).json(atualizado)
  } catch (error) {
    res.status(500).json({ error: "Erro ao atualizar item", details: error })
  }
})

// DELETE /lista/:id -> remove o livro da lista (as reviews do usuário continuam)
router.delete("/:id", async (req, res) => {
  const usuarioId = req.usuarioId!

  try {
    const item = await itemDoUsuario(Number(req.params.id), usuarioId)
    if (!item) return res.status(404).json({ error: "Item não encontrado na sua lista" })

    await prisma.listaLeitura.delete({ where: { id: item.id } })
    res.status(204).send()
  } catch (error) {
    res.status(500).json({ error: "Erro ao remover item", details: error })
  }
})

// POST /lista/:id/review  { titulo, conteudo?, nota } -> cria a review do livro da lista
// Só para livros já lidos; o usuário vem do token e o livro vem do item da lista
router.post("/:id/review", async (req, res) => {
  const usuarioId = req.usuarioId!
  const valida = reviewSchema.safeParse(req.body)
  if (!valida.success) return res.status(400).json({ error: valida.error.flatten() })

  try {
    const item = await itemDoUsuario(Number(req.params.id), usuarioId)
    if (!item) return res.status(404).json({ error: "Item não encontrado na sua lista" })
    if (item.status !== "LIDO") {
      return res.status(400).json({ error: "Marque o livro como lido antes de fazer a review" })
    }

    const jaAvaliou = await prisma.review.findFirst({
      where: { usuarioId, livros_id: item.livroId },
    })
    if (jaAvaliou) return res.status(409).json({ error: "Você já fez a review desse livro" })

    const review = await prisma.review.create({
      data: { ...valida.data, usuarioId, livros_id: item.livroId },
      include: { livro: true },
    })
    res.status(201).json(review)
  } catch (error) {
    res.status(500).json({ error: "Erro ao criar review", details: error })
  }
})

export default router
