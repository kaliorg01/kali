package org.kali.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.content.res.Configuration;
import android.graphics.Bitmap;
import android.graphics.PixelFormat;
import android.hardware.display.DisplayManager;
import android.hardware.display.VirtualDisplay;
import android.media.Image;
import android.media.ImageReader;
import android.media.projection.MediaProjection;
import android.media.projection.MediaProjectionManager;
import android.os.Build;
import android.os.Handler;
import android.os.HandlerThread;
import android.os.IBinder;
import android.os.SystemClock;
import android.util.Base64;
import android.util.DisplayMetrics;

import java.io.ByteArrayOutputStream;
import java.nio.ByteBuffer;

/** Grava a tela (MediaProjection) e manda ~25 quadros por segundo pro KALI, em até 1080p. */
public class TelaServico extends Service {
    private static final int MAX_LADO = 1920; // 1080p (antes 720p)
    private static final long INTERVALO_MS = 40; // ~25 fps (antes ~15)
    private static final int QUALIDADE_JPEG = 88; // menos borrão em texto e HUD de jogo (antes 72)

    private MediaProjection proj;
    private VirtualDisplay vd;
    private ImageReader leitor;
    private HandlerThread fio;
    private Handler hd;
    private long ultimo = 0;
    private int largura, altura;
    private boolean parado = false;

    @Override
    public IBinder onBind(Intent i) { return null; }

    @Override
    public int onStartCommand(Intent i, int flags, int id) {
        mostrarNotificacao();
        if (i == null) { parar(); return START_NOT_STICKY; }
        int codigo = i.getIntExtra("codigo", 0);
        Intent dados = i.getParcelableExtra("dados");
        MediaProjectionManager m = (MediaProjectionManager) getSystemService(MEDIA_PROJECTION_SERVICE);
        proj = dados != null ? m.getMediaProjection(codigo, dados) : null;
        if (proj == null) { parar(); return START_NOT_STICKY; }

        fio = new HandlerThread("kali-tela");
        fio.start();
        hd = new Handler(fio.getLooper());
        proj.registerCallback(new MediaProjection.Callback() {
            @Override public void onStop() { parar(); }
        }, hd);

        calcularTamanho();
        leitor = novoLeitor();
        DisplayMetrics dm = getResources().getDisplayMetrics();
        vd = proj.createVirtualDisplay("kali-tela", largura, altura, dm.densityDpi,
                DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR, leitor.getSurface(), null, hd);
        return START_NOT_STICKY;
    }

    /** Mantém a proporção da tela (em pé ou deitada) com no máximo 1280px no lado maior. */
    private void calcularTamanho() {
        DisplayMetrics dm = getResources().getDisplayMetrics();
        int w = dm.widthPixels, h = dm.heightPixels;
        float esc = Math.min(1f, (float) MAX_LADO / Math.max(w, h));
        largura = Math.max(2, Math.round(w * esc) & ~1);
        altura = Math.max(2, Math.round(h * esc) & ~1);
    }

    private ImageReader novoLeitor() {
        ImageReader r = ImageReader.newInstance(largura, altura, PixelFormat.RGBA_8888, 2);
        r.setOnImageAvailableListener(this::aoQuadro, hd);
        return r;
    }

    private void aoQuadro(ImageReader r) {
        Image img = null;
        try {
            img = r.acquireLatestImage();
            if (img == null) return;
            long agora = SystemClock.uptimeMillis();
            if (agora - ultimo < INTERVALO_MS) return;
            ultimo = agora;
            int w = img.getWidth(), h = img.getHeight();
            Image.Plane p = img.getPlanes()[0];
            ByteBuffer buf = p.getBuffer();
            int px = p.getPixelStride(), linha = p.getRowStride();
            Bitmap bruto = Bitmap.createBitmap(linha / px, h, Bitmap.Config.ARGB_8888);
            bruto.copyPixelsFromBuffer(buf);
            Bitmap final_ = bruto.getWidth() != w ? Bitmap.createBitmap(bruto, 0, 0, w, h) : bruto;
            ByteArrayOutputStream out = new ByteArrayOutputStream(64 * 1024);
            final_.compress(Bitmap.CompressFormat.JPEG, QUALIDADE_JPEG, out);
            if (final_ != bruto) final_.recycle();
            bruto.recycle();
            MainActivity a = MainActivity.atual;
            if (a != null) a.quadro(Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP));
        } catch (Exception e) {
            // quadro perdido: segue o próximo
        } finally {
            if (img != null) img.close();
        }
    }

    /** Girou o celular (jogo deitado): ajusta o tamanho da gravação. */
    @Override
    public void onConfigurationChanged(Configuration c) {
        super.onConfigurationChanged(c);
        if (vd == null || hd == null) return;
        hd.post(() -> {
            int antesW = largura, antesH = altura;
            calcularTamanho();
            if (antesW == largura && antesH == altura) return;
            ImageReader velho = leitor;
            leitor = novoLeitor();
            vd.resize(largura, altura, getResources().getDisplayMetrics().densityDpi);
            vd.setSurface(leitor.getSurface());
            velho.close();
        });
    }

    private void mostrarNotificacao() {
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        Notification.Builder b;
        if (Build.VERSION.SDK_INT >= 26) {
            nm.createNotificationChannel(new NotificationChannel("tela", "Transmissão de tela", NotificationManager.IMPORTANCE_LOW));
            b = new Notification.Builder(this, "tela");
        } else {
            b = new Notification.Builder(this);
        }
        Notification n = b.setContentTitle("KALI está transmitindo sua tela")
                .setContentText("Volta pro KALI pra parar de compartilhar.")
                .setSmallIcon(android.R.drawable.presence_video_online)
                .setOngoing(true)
                .build();
        if (Build.VERSION.SDK_INT >= 29) startForeground(1, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION);
        else startForeground(1, n);
    }

    private void parar() {
        if (parado) return;
        parado = true;
        try { if (vd != null) vd.release(); } catch (Exception e) { }
        try { if (leitor != null) leitor.close(); } catch (Exception e) { }
        try { if (proj != null) proj.stop(); } catch (Exception e) { }
        if (fio != null) fio.quitSafely();
        MainActivity a = MainActivity.atual;
        if (a != null) a.js("window.__kaliTelaParou && __kaliTelaParou()");
        if (Build.VERSION.SDK_INT >= 24) stopForeground(STOP_FOREGROUND_REMOVE);
        stopSelf();
    }

    @Override
    public void onDestroy() {
        parar();
        super.onDestroy();
    }
}
