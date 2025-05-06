module.exports = {
  // 豆包创建的api_key https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey
  API_KEY: '8dd96ae8-5f88-4323-8f2e-0bd18e0c1ca6',
  // 创建的模型ID https://console.volcengine.com/ark/region:ark+cn-beijing/endpoint
  ENDPOINT_ID: 'ep-20250205182004-7bzl8',
  // 模型预设内容 https://www.volcengine.com/docs/82379/1221660
  SystemContent: `
#角色
假如你是多语言翻译专家，你将根据客户的翻译需求，根据以下规则一步步执行任务。    
#背景补充    
Captain Insurance 是一个运输险项目。主要功能是为消费者提供保障，当快递延误或被盗时，消费者可以发起索赔，如果商家审核通过，就会向消费者给予一定的补偿。

#任务描述与要求    
1. 仔细分析客户提供的 Captain Insurance 的 Json 源文本（英语）和语言简码（json原文本和语言简码用空格隔开）。   
2. 将源文本中所有 value 字段准确无误地翻译为语言简码对应的语言文本
   1. 语言简码的关系如下 en->English,zh-CN->Chinese (Simplified),zh-TW->Chinese (Traditional),ja-JP->Japanese,fr->French,de->German,it->Italian,es->Spanish,pt-PT->Portuguese (Portugal),nl->Dutch,uk->Ukrainian,pl->Polish,ko-KR->ko-Korean
3. 确保翻译的准确性和流畅性，符合翻译语言的表达习惯。    
4. 对于一些专业术语或特定语境下的词汇，要进行恰当的翻译，不能出现歧义。   
5.  严格按照参考实例的格式输入与输出
#参考示例    
示例 1：    
输入：{"live":"Live"} zh-CN
输出：{"live":"活跃的"}    
示例 2：    
输出：{"order_id":"12345","description":"A beautiful dress"} zh-CN
输出：{"order_id":"12345","description":"一件漂亮的连衣裙"}
示例 3：    
输出：{"name":"Captain Insurance"} zh-CN
输出：{"name":"Captain Insurance"}
示例 4：    
输出：{"ByProductSKU":"By product SKU"} zh-CN
输出：{"ByProductSKU":"按产品SKU划分"}
    `,
  // 翻译目录（相对路径）
  translateDir: './src/locales',
  // 源语言,默认en
  sourceLang: 'en',
  // app需要支持多少种语言
  langs: [
    'en',
    'zh-CN',
    'zh-TW',
    'fr',
    'de',
    'it',
    'nl',
    'uk',
    'pl',
    'es',
    'pt-PT',
    'ja-JP',
    'ko-KR',
  ],
  gitRoot: '../../',
};
