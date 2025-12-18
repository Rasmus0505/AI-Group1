import json
import re

# 读取原始文件
input_file = 'c:/Users/99251/Desktop/人工智能小组/12.17-B/AI-Group1/后端/local_game_data.json'
output_file = 'c:/Users/99251/Desktop/人工智能小组/12.17-B/AI-Group1/后端/local_game_data.json'

# 处理冲突并保留Updated upstream版本
processed_lines = []
skip_section = False

with open(input_file, 'r', encoding='utf-8') as f:
    lines = f.readlines()
    
    i = 0
    while i < len(lines):
        line = lines[i]
        stripped_line = line.strip()
        
        # 检测冲突开始
        if stripped_line.startswith('<<<<<<<'):
            # 开始收集冲突内容
            conflict_start = i
            i += 1
            # 跳过直到找到分隔符
            while i < len(lines) and not lines[i].strip().startswith('======='):
                processed_lines.append(lines[i])
                i += 1
            # 跳过分隔符
            if i < len(lines) and lines[i].strip().startswith('======='):
                i += 1
                # 现在跳过Stashed changes部分直到冲突结束
                while i < len(lines) and not lines[i].strip().startswith('>>>>>>>'):
                    i += 1
                # 跳过冲突结束标记
                if i < len(lines) and lines[i].strip().startswith('>>>>>>>'):
                    i += 1
            else:
                # 如果没有找到分隔符，添加当前行并继续
                processed_lines.append(line)
                i += 1
        else:
            # 正常行，添加到处理后的内容
            processed_lines.append(line)
            i += 1

# 尝试解析和重新格式化JSON以修复格式问题
try:
    # 合并处理后的行
    content_str = ''.join(processed_lines)
    
    # 尝试解析JSON
    data = json.loads(content_str)
    
    # 重新格式化JSON并保存
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    print(f'成功修复所有GitHub冲突并生成有效的JSON文件！')
    print(f'文件已保存到: {output_file}')
    
except json.JSONDecodeError as e:
    print(f'JSON解析失败，尝试使用更宽松的方式修复...')
    print(f'错误信息: {e}')
    
    # 尝试使用正则表达式修复常见的格式问题
    content_str = ''.join(processed_lines)
    
    # 移除空的对象或数组
    content_str = re.sub(r'\{\s*\}', '{}', content_str)
    content_str = re.sub(r'\[\s*\]', '[]', content_str)
    
    # 尝试再次解析
    try:
        data = json.loads(content_str)
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print('成功修复格式问题并保存文件！')
    except Exception as e2:
        print(f'无法修复JSON格式。请手动检查文件。')
        print(f'详细错误: {e2}')
        # 保存处理过但可能仍有问题的文件
        with open(output_file + '.fixed', 'w', encoding='utf-8') as f:
            f.write(content_str)
        print(f'已保存处理过的文件到: {output_file}.fixed')

except Exception as e:
    print(f'处理过程中发生错误: {e}')
