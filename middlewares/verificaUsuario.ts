import jwt from "jsonwebtoken"
import { Request, Response, NextFunction } from "express"

// Token gerado em routes/login.ts (login de usuário)
type TokenUsuario = {
  clienteLogadoId: number
  clienteLogadoNome: string
}

// Adiciona usuarioId no Request do Express
declare global {
  namespace Express {
    interface Request {
      usuarioId?: number
    }
  }
}

export function verificaUsuario(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.split(" ")[1]
  if (!token) return res.status(401).json({ error: "Faça login para continuar" })

  try {
    const { clienteLogadoId } = jwt.verify(token, process.env.JWT_KEY as string) as TokenUsuario
    if (!clienteLogadoId) return res.status(401).json({ error: "Token inválido" })
    req.usuarioId = Number(clienteLogadoId)
    next()
  } catch {
    res.status(401).json({ error: "Token inválido ou expirado" })
  }
}
