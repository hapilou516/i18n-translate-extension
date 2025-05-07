

import axios from 'axios';

interface TranslateParams {
    API_KEY: string;
    ENDPOINT_ID: string;
    SystemContent: string;
    translateContent: string;
    lang: string;
}

type TranslateResult = [Record<string, any> | null, any?];

async function translate({
    API_KEY,
    ENDPOINT_ID,
    SystemContent,
    translateContent,
    lang
}: TranslateParams): Promise<TranslateResult> {
    try {
        console.log('translateContent 11111111', translateContent);
        const res = await axios({
            method: "post",
            url: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
            headers: {
                "Authorization": `Bearer ${API_KEY}`,
                "Content-Type": "application/json"
            },
            data: {
                "model": `${ENDPOINT_ID}`,
                "messages": [
                    {
                        "role": "system",
                        "content": SystemContent
                    },
                    {
                        "role": "user",
                        "content": translateContent + ' ' + lang
                    }
                ],
                "temperature": 0.2
            }
        });
        const content = res.data.choices[0].message.content;
        // 尝试提取有效的JSON部分
        let jsonContent;
        try {
            // 先尝试直接解析
            jsonContent = JSON.parse(content);
        } catch (jsonError) {
            // 如果直接解析失败，尝试提取JSON部分
            const jsonMatch = content.match(/({[\s\S]*})/);
            if (jsonMatch && jsonMatch[1]) {
                try {
                    jsonContent = JSON.parse(jsonMatch[1]);
                } catch (error) {
                    console.error('Failed to parse extracted JSON', error);
                    return [null, 'Failed to parse JSON from API response'];
                }
            } else {
                console.error('No valid JSON found in response');
                return [null, 'No valid JSON found in response'];
            }
        }

        return [jsonContent];
    } catch (error: any) {
        console.error('translateError', error);
        return [null, error.response?.data?.error];
    }
}
export { translate };