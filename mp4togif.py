import os
from moviepy import VideoFileClip

def batch_convert_videos_to_gif():
    input_dir = "input_video"
    output_dir = "output_gif"

    # フォルダの存在確認と作成
    for folder in [input_dir, output_dir]:
        if not os.path.exists(folder):
            os.makedirs(folder)

    # 対応する動画拡張子の定義
    valid_extensions = ('.mp4', '.mov', '.avi', '.mkv', '.wmv', '.flv')

    # 入力フォルダ内のファイルリストを取得
    files = [f for f in os.listdir(input_dir) if f.lower().endswith(valid_extensions)]

    if not files:
        print(f"情報: {input_dir} 内に変換可能な動画ファイルが見つからない。")
        return

    print(f"{len(files)} 件のファイルを処理開始する。")

    for filename in files:
        input_path = os.path.join(input_dir, filename)
        
        # 出力ファイル名の設定（拡張子を.gifに変更）
        output_filename = os.path.splitext(filename)[0] + ".gif"
        output_path = os.path.join(output_dir, output_filename)

        print(f"変換中: {filename} -> {output_filename}")

        try:
            # 動画の読み込みと変換
            with VideoFileClip(input_path) as clip:
                # 元動画の解像度とfpsを自動で引き継ぐ
                clip.write_gif(output_path, fps=clip.fps)
            
            print(f"成功: {output_filename}")
            
        except Exception as e:
            print(f"エラー（{filename}）: {e}")

    print("すべての処理が完了した。")

if __name__ == "__main__":
    batch_convert_videos_to_gif()