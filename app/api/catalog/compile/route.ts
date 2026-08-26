import { NextResponse } from "next/server";
import { importCatalogCsv } from "@/core/importer";
import { compileFactsWithQwen, type ImageInput } from "@/lib/qwen-compiler";
import { qwenConfig } from "@/lib/qwen";

export const runtime = "nodejs";

const allowedImageTypes = new Set(["image/png", "image/jpeg", "image/webp"]);
const maxCatalogBytes = 2 * 1024 * 1024;
const maxPolicyBytes = 2 * 1024 * 1024;
const maxImageBytes = 10 * 1024 * 1024;

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

async function imageInput(file: File): Promise<ImageInput> {
  if (!allowedImageTypes.has(file.type)) {
    throw new Error(`不支持的图片格式：${file.type || "未知格式"}`);
  }
  if (file.size > maxImageBytes) {
    throw new Error(`图片 ${file.name} 超过 10 MB 限制。`);
  }
  return {
    mimeType: file.type as ImageInput["mimeType"],
    base64: Buffer.from(await file.arrayBuffer()).toString("base64"),
  };
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const catalogFile = form.get("catalog");
    const policyFile = form.get("policy");
    const imageFiles = form.getAll("images");
    const useModel = form.get("useModel") !== "false";
    const requestedModel = form.get("model");
    const config = qwenConfig(typeof requestedModel === "string" ? requestedModel : undefined);

    if (!(catalogFile instanceof File)) {
      return badRequest("必须上传商品 CSV 文件。");
    }
    if (catalogFile.size > maxCatalogBytes) {
      return badRequest("商品 CSV 超过 2 MB 限制。");
    }

    const imported = importCatalogCsv(await catalogFile.text());
    if (imported.catalog.length === 0) {
      return NextResponse.json(
        { error: "CSV 中没有可用的商品记录。", issues: imported.issues },
        { status: 422 },
      );
    }

    let policyText = "";
    if (policyFile instanceof File) {
      if (policyFile.size > maxPolicyBytes) {
        return badRequest("政策文件超过 2 MB 限制。");
      }
      policyText = await policyFile.text();
    }

    const rawImages = imageFiles.filter((item): item is File => item instanceof File).slice(0, 4);
    const images = await Promise.all(rawImages.map(imageInput));
    let compiledFacts = null;
    let modelWarning = null;

    if (useModel && config.configured && (images.length > 0 || policyText.trim())) {
      try {
        compiledFacts = await compileFactsWithQwen({
          catalog: imported.catalog,
          policyText,
          images,
        }, config.model);
      } catch {
        modelWarning = "Qwen 商品资料识别失败，请检查模型配置后重试。";
      }
    } else if (useModel && !config.configured) {
      modelWarning = "未配置 DASHSCOPE_API_KEY，已使用固定规则整理 CSV。";
    }

    return NextResponse.json({
      catalog: imported.catalog,
      issues: imported.issues,
      stats: {
        rowsRead: imported.rowsRead,
        rowsAccepted: imported.rowsAccepted,
        products: imported.catalog.length,
        images: images.length,
        policyCharacters: policyText.length,
      },
      compiledFacts,
      modelWarning,
      model: config.model,
    });
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : "商品资料处理失败");
  }
}
