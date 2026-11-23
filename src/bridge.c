/* FLEX Denon bridge: fixed receiver, no shell, no listening network socket.
 * Talks only to the receiver; no probing of source devices by IP (removed 2026-11-15, CEC instead).
 * Runs as launcher uid 10009. Requests live in RAM; before-state is journalled.
 */
#define _GNU_SOURCE
#include <arpa/inet.h>
#include <errno.h>
#include <fcntl.h>
#include <poll.h>
#include <signal.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/file.h>
#include <sys/socket.h>
#include <sys/stat.h>
#include <time.h>
#include <unistd.h>
#define DIR "/tmp/flexdenon/b"
#define HISTORY "/APPS/flexdenon/history"
static const char *receiver_host;
static char assign_xml[20000], names_xml[12000], video_xml[8000];
static const char *queries[]={"ZM?","Z2?","SI?","MV?","MU?","MS?","CV?","PSTONE CTRL ?","PSBAS ?","PSTRE ?","PSDYNEQ ?","PSDYNVOL ?","PSMULTEQ: ?",NULL};
static int connect_port(int port) {
 int s=socket(AF_INET,SOCK_STREAM,0); if(s<0)return -1;
 fcntl(s,F_SETFL,O_NONBLOCK);
 struct sockaddr_in a={.sin_family=AF_INET,.sin_port=htons((unsigned short)port)};
 if(inet_pton(AF_INET,receiver_host,&a.sin_addr)!=1){close(s);return -1;}
 int r=connect(s,(void*)&a,sizeof a);
 if(r<0&&errno!=EINPROGRESS){close(s);return -1;}
 struct pollfd p={s,POLLOUT,0}; int e=0; socklen_t n=sizeof e;
 if(poll(&p,1,2000)<=0||getsockopt(s,SOL_SOCKET,SO_ERROR,&e,&n)||e){close(s);return -1;}
 return s;
}
static int connect_avr(void){return connect_port(23);}
static int http_read(const char *path,char *out,size_t cap){
 int s=connect_port(11080);if(s<0)return -1;
 char req[256],buf[30000];size_t used=0;
 int n=snprintf(req,sizeof req,"GET %s HTTP/1.0\r\nHost: %s\r\nConnection: close\r\n\r\n",path,receiver_host);
 if(send(s,req,n,MSG_NOSIGNAL)!=n){close(s);return -1;}
 struct pollfd p={s,POLLIN,0};int rounds=0;
 while(rounds++<20){int ready=poll(&p,1,250);if(ready<0){close(s);return -1;}if(!ready)continue;ssize_t k=recv(s,buf+used,sizeof buf-used-1,0);if(k<=0)break;used+=(size_t)k;if(used>=sizeof buf-1){close(s);return -1;}}
 close(s);buf[used]=0;
 char *body=strstr(buf,"\r\n\r\n");
 if(!body||!strstr(buf," 200 ")||strstr(buf,"Transfer-Encoding: chunked"))return -1;
 body+=4;if(strlen(body)>=cap||!strstr(body,"<?xml"))return -1;strcpy(out,body);return 0;
}
static int read_small(const char *path,char *out,size_t cap){int f=open(path,O_RDONLY|O_NOFOLLOW|O_NONBLOCK);if(f<0){out[0]=0;return -1;}struct stat st;if(fstat(f,&st)||!S_ISREG(st.st_mode)){close(f);return -1;}ssize_t n=read(f,out,cap-1);close(f);if(n<0)return -1;out[n]=0;return 0;}
static int exchange(int s,const char *q,char *out,size_t cap) {
 char cmd[128]; int len=snprintf(cmd,sizeof cmd,"%s\r",q);
 if(send(s,cmd,len,MSG_NOSIGNAL)!=len)return -1;
 size_t used=strlen(out); int rounds=0;
 struct pollfd p={s,POLLIN,0};
 while(rounds++<20 && poll(&p,1,220)>0) {
  if(used+1>=cap)return -1;
  ssize_t n=recv(s,out+used,cap-used-1,0);
  if(n<=0)return -1;
  used+=(size_t)n;out[used]=0;
 }
 return 0;
}
static int snapshot(int s,char *out,size_t cap){
 out[0]=0;
 for(int i=0;queries[i];i++)if(exchange(s,queries[i],out,cap))return -1;
 return strstr(out,"ZM")&&strstr(out,"SI")?0:-1;
}
static int oneof(const char *v,const char *const *a){for(int i=0;a[i];i++)if(!strcmp(v,a[i]))return 1;return 0;}
static int valid(const char *c){
 static const char *const fixed[]={"ZMON","ZMOFF","Z2ON","Z2OFF","SIGAME1","SITV","SIBD","SIMPLAY","SISAT/CBL","SIAUX1","SIAUX2","Z2GAME1","MUON","MUOFF",
 "MSSTEREO","MSDIRECT","MSPURE DIRECT","MSDOLBY AUDIO-DSUR","MSDTS NEURAL:X",
 "PSTONE CTRL ON","PSTONE CTRL OFF","PSDYNEQ ON","PSDYNEQ OFF","PSDYNVOL OFF","PSDYNVOL LIT","PSDYNVOL MED","PSDYNVOL HEV",
 "PSMULTEQ:AUDYSSEY","PSMULTEQ:BYP.LR","PSMULTEQ:FLAT","PSMULTEQ:OFF",NULL};
 if(oneof(c,fixed))return 1;
 if(!strncmp(c,"MV",2)){const char *v=c+2;size_t n=strlen(v);if(n!=2&&n!=3)return 0;for(size_t i=0;i<n;i++)if(v[i]<'0'||v[i]>'9')return 0;return (n==2?atoi(v)*10:atoi(v))<=800&&(n==2||v[2]=='5');}
 if(!strncmp(c,"PSBAS ",6)||!strncmp(c,"PSTRE ",6)){const char *v=c+6;return strlen(v)==2&&v[0]>='0'&&v[0]<='9'&&v[1]>='0'&&v[1]<='9'&&atoi(v)>=44&&atoi(v)<=56;}
 if(!strncmp(c,"CV",2)){
  static const char *const channels[]={"FL","FR","C","SW","SW2","SW3","SW4","SL","SR","SBL","SBR","FHL","FHR","TFL","TFR","TML","TMR","TRL","TRR",NULL};
  char ch[8],v[8],extra; if(sscanf(c+2,"%7s %7s%c",ch,v,&extra)!=2||!oneof(ch,channels))return 0;
  size_t n=strlen(v);if(n!=2&&n!=3)return 0;for(size_t i=0;i<n;i++)if(v[i]<'0'||v[i]>'9')return 0;
  int x=n==2?atoi(v)*10:atoi(v);return x>=380&&x<=620&&(n==2||v[2]=='5');
 }
 return 0;
}
static int atomic_file(const char *path,const char *data){
 char tmp[256];snprintf(tmp,sizeof tmp,"%s.new",path);
 int fd=open(tmp,O_WRONLY|O_CREAT|O_EXCL|O_NOFOLLOW,0600);if(fd<0)return -1;
 size_t len=strlen(data);int ok=write(fd,data,len)==(ssize_t)len&&fsync(fd)==0;close(fd);
 if(!ok){unlink(tmp);return -1;}if(rename(tmp,path)){unlink(tmp);return -1;}return 0;
}
static void quoted(FILE *f,const char *s){fputc('"',f);for(;*s;s++){unsigned char c=*s;if(c=='"'||c=='\\')fprintf(f,"\\%c",c);else if(c=='\r'||c=='\n')fputs("\\n",f);else if(c>=32)fputc(c,f);}fputc('"',f);}
static void answer(const char *id,const char *error,const char *raw,int verified){
 char *buf=NULL;size_t n=0;FILE *f=open_memstream(&buf,&n);
 if(!f)return;
 fprintf(f,"{\"id\":\"%s\",\"ok\":%s,\"verified\":%s,\"error\":",id,*error?"false":"true",verified?"true":"false");quoted(f,error);fputs(",\"raw\":",f);quoted(f,raw);
 fputs(",\"assign\":",f);quoted(f,assign_xml);fputs(",\"names\":",f);quoted(f,names_xml);fputs(",\"video\":",f);quoted(f,video_xml);
 fputs(",\"labels\":{",f);for(int i=1;i<=6;i++){char path[128],label[100]="";snprintf(path,sizeof path,"/APPS/flexdenon/labels/%d",i);read_small(path,label,sizeof label);fprintf(f,"%s\"%d\":",i==1?"":",",i);quoted(f,label);}fputs("}}",f);fclose(f);
 atomic_file(DIR "/response",buf);free(buf);
}
static int hasline(const char *raw,const char *line){size_t n=strlen(line);for(const char *p=raw;*p;){const char *e=strchr(p,'\r');size_t l=e?(size_t)(e-p):strlen(p);if(l==n&&!memcmp(p,line,n))return 1;if(!e)break;p=e+1;}return 0;}
int main(int argc,char **argv){
 if(argc==3&&!strcmp(argv[1],"--validate"))return valid(argv[2])?0:2;
 struct in_addr address;
 receiver_host=getenv("FLEX_DENON_HOST");
 if(!receiver_host||inet_pton(AF_INET,receiver_host,&address)!=1){
  fputs("Set FLEX_DENON_HOST to the IPv4 address of your receiver.\n",stderr);
  return 2;
 }
 signal(SIGPIPE,SIG_IGN);umask(0077);
 int lock=open(DIR "/lock",O_RDWR|O_CREAT|O_NOFOLLOW,0600);if(lock<0||flock(lock,LOCK_EX|LOCK_NB))return 2;
 /* Do not replay a command left behind by an earlier service instance. */
 unlink(DIR "/request");
 if(getuid()==0){if(setgid(10009)||setuid(10009))return 2;}
 char last[40]="";
 for(;;){
  usleep(150000);
  int fd=open(DIR "/request",O_RDONLY|O_NOFOLLOW|O_NONBLOCK);if(fd<0)continue;
  struct stat st;char req[256];ssize_t n=-1;
  if(!fstat(fd,&st)&&S_ISREG(st.st_mode)&&st.st_uid==10009&&st.st_size>0&&st.st_size<255)n=read(fd,req,sizeof req-1);
  close(fd);if(n<=0)continue;req[n]=0;
  char id[40],op[100],tail;
  if(sscanf(req,"%39[0-9-]\n%99[^\n]\n%c",id,op,&tail)!=2||!strcmp(id,last))continue;
  /* Ignore old queued operations after a restart or a UI timeout. */
  long long stamp=atoll(id)/1000; if(llabs((long long)time(NULL)-stamp)>25){snprintf(last,sizeof last,"%s",id);answer(id,"Auftrag abgelaufen","",0);continue;}
  snprintf(last,sizeof last,"%s",id);
  if(!strncmp(op,"LABEL",5)){
   int port=op[5]-'0';const char *label=op+7;int good=port>=1&&port<=6&&op[6]==' '&&strlen(op)>=8&&strlen(label)<=64;
   for(const unsigned char *p=(const unsigned char*)label;good&&*p;p++)if(*p<32||*p==127)good=0;
   if(!good){answer(id,"Ungueltige Beschriftung","",0);continue;}
   char path[128],backup[160],old[100]="";snprintf(path,sizeof path,"/APPS/flexdenon/labels/%d",port);read_small(path,old,sizeof old);snprintf(backup,sizeof backup,HISTORY "/%s-label.txt",id);
   if(atomic_file(backup,old)||atomic_file(path,label)){answer(id,"Beschriftung nicht gespeichert","",0);continue;}
   answer(id,"","",1);continue;
  }
  if(strcmp(op,"STATUS")&&strcmp(op,"SOURCES")&&!valid(op)){answer(id,"Befehl nicht erlaubt","",0);continue;}
  int s=connect_avr();if(s<0){answer(id,"Receiver nicht erreichbar","",0);continue;}
  char before[24000],after[24000],reply[4000]="";
  if(snapshot(s,before,sizeof before)){close(s);answer(id,"Status konnte nicht gelesen werden","",0);continue;}
  if(!strcmp(op,"STATUS")||!strcmp(op,"SOURCES")){
   close(s);
   if(!strcmp(op,"SOURCES")){
    assign_xml[0]=names_xml[0]=video_xml[0]=0;
    int failed=http_read("/ajax/inputs/get_config?type=2",assign_xml,sizeof assign_xml);
    failed|=http_read("/ajax/inputs/get_config?type=3",names_xml,sizeof names_xml);
    failed|=http_read("/ajax/info/get_config?type=3",video_xml,sizeof video_xml);
    answer(id,failed?"Quellen-Metadaten nicht vollstaendig erreichbar":"",before,0);
   }else answer(id,"",before,0);
   continue;
  }
  if(!strncmp(op,"CV",2)){
   char prefix[16];const char *space=strchr(op,' ');size_t len=(size_t)(space-op)+1;
   memcpy(prefix,op,len);prefix[len]=0;
   if(!strstr(before,prefix)){close(s);answer(id,"Kanal nicht vom Receiver gemeldet",before,0);continue;}
  }
  char path[256];snprintf(path,sizeof path,HISTORY "/%s.txt",id);
  /* A failed durable before-state backup prevents the write. */
  if(atomic_file(path,before)){close(s);answer(id,"Sicherung fehlgeschlagen; nichts geaendert",before,0);continue;}
  if(exchange(s,op,reply,sizeof reply)){close(s);answer(id,"Senden fehlgeschlagen; Zustand pruefen",before,0);continue;}
  usleep(1500000);
  if(snapshot(s,after,sizeof after)){close(s);answer(id,"Ruecklesen fehlgeschlagen; Zustand pruefen","",0);continue;}
  close(s);
  int verified=hasline(after,op);
  answer(id,verified?"":"Zielwert nicht bestaetigt (Modus/CEC pruefen)",after,verified);
 }
}
