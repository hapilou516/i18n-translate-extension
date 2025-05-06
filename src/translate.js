const axios = require('axios');

async function translate({ API_KEY, ENDPOINT_ID, SystemContent, translateContent, lang }) {

    try {
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
                        "content": JSON.stringify(translateContent, null, 2) + ' ' + lang
                    }
                ],
                "temperature": 0.2
            }
        });
        const content = res.data.choices[0].message.content;
        return [JSON.parse(content)];       
    } catch (error) {
        console.error('translateError', error);
        return [null, error.response?.data?.error];
    }
}

module.exports = {
    translate
};