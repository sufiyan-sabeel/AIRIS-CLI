CC      ?= cc
CFLAGS  ?= -O2 -Wall -Wextra
TARGET  = airis-procmon

all: $(TARGET)

$(TARGET): procmon.c
	$(CC) $(CFLAGS) -o $(TARGET) procmon.c

clean:
	rm -f $(TARGET)

.PHONY: all clean
