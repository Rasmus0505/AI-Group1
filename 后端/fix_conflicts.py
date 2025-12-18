import json
import re

# 读取原始文件
input_file = 'c:/Users/99251/Desktop/人工智能小组/12.17-B/AI-Group1/后端/local_game_data.json'
output_file = 'c:/Users/99251/Desktop/人工智能小组/12.17-B/AI-Group1/后端/local_game_data_fixed.json'

# 冲突状态标志
in_conflict = False
keep_content = []
conflict_content = []

with open(input_file, 'r', encoding='utf-8') as f:
    for line in f:
        stripped_line = line.strip()
        
        # 检测冲突开始
        if stripped_line.startswith('<<<<<<<'):
            in_conflict = True
            conflict_content = []
        # 检测冲突分隔符
        elif stripped_line.startswith('=======') and in_conflict:
            # 已经收集了Updated upstream的内容
            # 现在重置冲突内容收集，准备收集Stashed changes（我们会忽略这些）
            conflict_content = []
        # 检测冲突结束
        elif stripped_line.startswith('>>>>>>>') and in_conflict:
            in_conflict = False
            # 我们不添加冲突标记和stashed changes部分
        # 如果不在冲突中，则添加到输出内容
        elif not in_conflict:
            keep_content.append(line)
        # 如果在冲突中的Updated upstream部分
        elif stripped_line.startswith('>>>>>>>') == False and stripped_line.startswith('=======') == False:
            # 只在分隔符之前收集内容（Updated upstream）
            if stripped_line.startswith('<<<<<<<') == False:
                conflict_content.append(line)

# 现在我们需要确保JSON格式正确
# 尝试将内容重新解析和序列化
content_str = ''.join(keep_content)

# 尝试解析JSON
with open(output_file, 'w', encoding='utf-8') as f:
    f.write(content_str)

print(f'文件已处理完成，输出到: {output_file}')
