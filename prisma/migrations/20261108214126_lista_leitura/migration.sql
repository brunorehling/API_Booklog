-- CreateEnum
CREATE TYPE "StatusLeitura" AS ENUM ('QUERO_LER', 'LENDO', 'LIDO');

-- CreateTable
CREATE TABLE "lista_leitura" (
    "id" SERIAL NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "livroId" INTEGER NOT NULL,
    "status" "StatusLeitura" NOT NULL DEFAULT 'QUERO_LER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lista_leitura_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "lista_leitura_usuarioId_livroId_key" ON "lista_leitura"("usuarioId", "livroId");

-- AddForeignKey
ALTER TABLE "lista_leitura" ADD CONSTRAINT "lista_leitura_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lista_leitura" ADD CONSTRAINT "lista_leitura_livroId_fkey" FOREIGN KEY ("livroId") REFERENCES "livros"("id") ON DELETE CASCADE ON UPDATE CASCADE;
