import json

# 验证修复后的JSON文件
try:
    with open('c:/Users/99251/Desktop/人工智能小组/12.17-B/AI-Group1/后端/local_game_data_fixed.json', 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    print('JSON格式验证通过！文件内容有效。')
    print(f'文件包含 {len(data)} 个顶级键')
    
    # 如果验证通过，替换原始文件
    import shutil
    backup_file = 'c:/Users/99251/Desktop/人工智能小组/12.17-B/AI-Group1/后端/local_game_data_backup.json'
    shutil.copy2('c:/Users/99251/Desktop/人工智能小组/12.17-B/AI-Group1/后端/local_game_data.json', backup_file)
    shutil.copy2('c:/Users/99251/Desktop/人工智能小组/12.17-B/AI-Group1/后端/local_game_data_fixed.json', 'c:/Users/99251/Desktop/人工智能小组/12.17-B/AI-Group1/后端/local_game_data.json')
    print('已更新原始文件，并创建了备份文件')
    
except json.JSONDecodeError as e:
    print(f'JSON格式验证失败！错误信息: {e}')
except Exception as e:
    print(f'发生其他错误: {e}')
