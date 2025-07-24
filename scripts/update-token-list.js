const fs = require('fs');
const path = require('path');

async function updateTokenList() {
  try {
    console.log('🔄 Fetching latest token list from Panora API...');
    
    // Вызываем наш API endpoint
    const response = await fetch('http://localhost:3000/api/panora/tokenList?chainId=1');
    
    if (!response.ok) {
      throw new Error(`API returned status ${response.status}`);
    }
    
    const data = await response.json();
    
    console.log(`✅ Received ${data.data.data.length} tokens from API`);
    
    // Путь к файлу tokenList.json
    const filePath = path.join(__dirname, '..', 'src', 'lib', 'data', 'tokenList.json');
    
    // Записываем данные в файл в правильном формате
    const tokenListData = {
      data: {
        status: data.data.status,
        data: data.data.data
      }
    };
    fs.writeFileSync(filePath, JSON.stringify(tokenListData, null, 2));
    
    console.log(`✅ Token list updated successfully!`);
    console.log(`📁 File saved to: ${filePath}`);
    console.log(`📊 Total tokens: ${data.data.data.length}`);
    
    // Показываем несколько примеров токенов
    console.log('\n📋 Sample tokens:');
    data.data.data.slice(0, 5).forEach(token => {
      console.log(`  - ${token.symbol} (${token.name})`);
    });
    
  } catch (error) {
    console.error('❌ Error updating token list:', error.message);
    process.exit(1);
  }
}

// Запускаем обновление
updateTokenList(); 