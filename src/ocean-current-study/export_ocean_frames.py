import json
import os
import sys
from pathlib import Path

# 使用 ArcGIS Pro 的 Python 时，加载它自带的 NetCDF DLL。
dll_path = Path(sys.executable).parent / "Library" / "bin"
if os.name == "nt" and dll_path.is_dir():
    dll_directory = os.add_dll_directory(str(dll_path))

import netCDF4
import numpy as np


def main():
    source = Path(
        r"D:\A_GIS_DATA\ocean current data\Copernicus-u-v-26.11.15-26.11.16"
    ) / "cmems_mod_glo_phy_anfc_merged-uv_PT1H-i_1794899234679.nc"
    folder = Path(__file__).resolve().parent
    output = folder / "ocean-frames"

    # 与当前 Demo 使用的裁剪范围对齐。
    reference = json.loads(
        (folder / "china-circulation-frame-001.json").read_text(encoding="utf-8")
    )
    west, south, east, north = reference["bbox"]
    output.mkdir(exist_ok=True)
    frames = []

    with netCDF4.Dataset(str(source), "r") as nc:
        longitude = np.asarray(nc["longitude"][:])
        latitude = np.asarray(nc["latitude"][:])
        # 容许经纬度浮点数在末尾存在微小误差。
        columns = np.flatnonzero(
            (longitude >= west - 0.0001) & (longitude <= east + 0.0001)
        )
        rows = np.flatnonzero(
            (latitude >= south - 0.0001) & (latitude <= north + 0.0001)
        )
        columns = columns[np.argsort(longitude[columns])]
        rows = rows[np.argsort(latitude[rows])[::-1]]
        width, height = len(columns), len(rows)
        if (width, height) != (reference["width"], reference["height"]):
            raise ValueError("裁剪后的网格与当前 Demo 不一致")

        time_variable = nc["time"]
        for time_index in range(len(time_variable)):
            # 第一层深度，行从北向南、列从西向东，配合 flipY: true。
            u = np.ma.filled(nc["uo"][time_index, 0, :, :], np.nan)
            v = np.ma.filled(nc["vo"][time_index, 0, :, :], np.nan)
            u = u[np.ix_(rows, columns)]
            v = v[np.ix_(rows, columns)]
            valid = np.isfinite(u) & np.isfinite(v)
            if not valid.any():
                raise ValueError(f"第 {time_index} 小时没有有效流速")

            date = netCDF4.num2date(
                time_variable[time_index],
                time_variable.units,
                calendar=time_variable.calendar,
            )
            time = date.strftime("%Y-%m-%dT%H:%M:%SZ")
            timestamp = int(netCDF4.date2num(
                date, "seconds since 1970-01-01", calendar="standard"
            ) * 1000)
            data = {
                "bbox": reference["bbox"],
                "width": width,
                "height": height,
                "time": timestamp,
                "unit": "meter second-1",
                "validMask": valid.ravel().astype(int).tolist(),
            }
            for name, values in [("u", u), ("v", v)]:
                data[name] = {
                    "array": np.where(valid, values, 0.0).ravel().tolist(),
                    "min": float(values[valid].min()),
                    "max": float(values[valid].max()),
                }

            filename = f"frame-{time_index:03d}.json"
            (output / filename).write_text(
                json.dumps(data, allow_nan=False, separators=(",", ":")),
                encoding="utf-8",
            )
            frames.append({"time": time, "file": filename})
            print(f"{filename}: {time}, {width} x {height}")

    (output / "index.json").write_text(
        json.dumps({"frames": frames}, indent=2), encoding="utf-8"
    )
    print(f"Saved to {output}")


if __name__ == "__main__":
    main()
