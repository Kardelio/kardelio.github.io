## Compress images

Website

    https://squoosh.app/editor

or CLI:

    ffmpeg -i <>.png -vf "scale=iw*0.5:ih*0.5:flags=lanczos"  -q:v 75 -compression_level 8 out3.webp
