/*
  Warnings:

  - A unique constraint covering the columns `[googleId]` on the table `livros` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "autores" ALTER COLUMN "nome" SET DATA TYPE VARCHAR(100);

-- AlterTable
ALTER TABLE "comentarios" ALTER COLUMN "conteudo" SET DATA TYPE VARCHAR;

-- AlterTable
ALTER TABLE "livros" ADD COLUMN     "googleId" TEXT,
ALTER COLUMN "nome" SET DATA TYPE VARCHAR(225),
ALTER COLUMN "dataLancamento" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "livros_googleId_key" ON "livros"("googleId");
