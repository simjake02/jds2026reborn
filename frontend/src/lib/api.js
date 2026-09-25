import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({
  baseURL: API,
  withCredentials: true,
});

export const fmtRp = (n) => {
  const v = Number(n || 0);
  return "Rp " + v.toLocaleString("id-ID");
};

export const fmtNum = (n) => Number(n || 0).toLocaleString("id-ID");

export const fmtDate = (s) => {
  if (!s) return "-";
  try {
    return new Date(s).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return s;
  }
};

export const BULAN = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];

export const monthLabel = (ym) => {
  if (!ym || !ym.includes("-")) return ym;
  const [y, m] = ym.split("-");
  return `${BULAN[parseInt(m) - 1]?.slice(0,3)} ${y}`;
};

export const downloadFile = async (path, filename) => {
  const res = await api.get(path, { responseType: "blob" });
  const url = window.URL.createObjectURL(new Blob([res.data]));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
};

export const downloadPost = async (path, body, filename) => {
  const res = await api.post(path, body, { responseType: "blob" });
  const url = window.URL.createObjectURL(new Blob([res.data]));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
};
