export async function analyzeStockImage(fileBuffer, fileName) {
  if (!fileBuffer || fileBuffer.length === 0) {
    throw new Error("EMPTY_FILE");
  }

  const apiKey = process.env.AI_API_KEY;
  console.log(`[AI-Service] Analyzing image. File: ${fileName}, size: ${fileBuffer.length} bytes`);

  // TODO: Gemini API Key를 사용하여 실제 이미지 분석 API(예: Google Gemini 1.5 Pro/Flash)를 연동하세요.
  if (apiKey === 'TODO_GEMINI_API_KEY') {
    console.warn("[AI-Service] Gemini API Key is currently set to DEFAULT/TODO. Please update it in .env.local file in the future.");
  }

  // AI 분석 대기 시뮬레이션 (1.5초)
  await new Promise((resolve) => setTimeout(resolve, 1500));

  const extractedItems = [
    { name: "삼성전자", amount: 7420000 },
    { name: "애플", amount: 11808000 },
    { name: "엔비디아", amount: 21900000 },
    { name: "테슬라", amount: 8529000 }
  ];

  console.log(`[AI-Service] Successfully extracted ${extractedItems.length} stock items from image`);
  return extractedItems;
}
