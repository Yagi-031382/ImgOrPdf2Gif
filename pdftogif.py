import os
from pdf2image import convert_from_path
from PIL import Image

def convert_pdf_to_gif():
    input_dir = "input_pdf"
    output_dir = "output_gif"

    # フォルダの作成
    for folder in [input_dir, output_dir]:
        if not os.path.exists(folder):
            os.makedirs(folder)

    # PDFファイルのリスト取得
    pdf_files = [f for f in os.listdir(input_dir) if f.lower().endswith('.pdf')]

    if not pdf_files:
        print(f"情報: {input_dir} 内にPDFファイルが見つからない。")
        return

    for filename in pdf_files:
        input_path = os.path.join(input_dir, filename)
        output_filename = os.path.splitext(filename)[0] + ".gif"
        output_path = os.path.join(output_dir, output_filename)

        print(f"処理中: {filename}")

        try:
            # PDFの全ページを画像に変換
            # thread_countを使用して処理速度を向上
            pages = convert_from_path(input_path, thread_count=4)

            if not pages:
                print(f"警告: {filename} のページを取得できなかった。")
                continue

            # 最初の一枚をベースに、残りのページを結合してGIF保存
            # durationは1ページあたりの表示時間（ミリ秒）
            pages[0].save(
                output_path,
                save_all=True,
                append_images=pages[1:],
                duration=1000,  # 1.0秒ごとにページ切り替え
                loop=0,         # 無限ループ
                optimize=True
            )
            
            print(f"成功: {output_filename}")

        except Exception as e:
            print(f"エラー（{filename}）: {e}")

if __name__ == "__main__":
    convert_pdf_to_gif()