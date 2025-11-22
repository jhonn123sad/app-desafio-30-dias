import { GoogleGenAI } from "@google/genai";

export const generateDailyAnalysis = async (
  completedTasks: string[], 
  totalTasks: number, 
  apiKey: string
): Promise<string> => {
  if (!apiKey) {
    return "Configure sua API Key do Gemini nas configurações para receber dicas personalizadas.";
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    
    const prompt = `
      Atue como um treinador de alta performance. 
      O usuário completou ${completedTasks.length} de ${totalTasks} tarefas hoje.
      As tarefas completadas foram: ${completedTasks.join(', ')}.
      
      Dê um feedback curto, motivacional e direto (máximo 3 frases) sobre o desempenho dele hoje.
      Se o desempenho for baixo, seja duro mas encorajador. Se for alto, parabenize a disciplina.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || "Sem resposta do treinador.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Erro ao conectar com o treinador IA. Verifique sua chave API.";
  }
};
